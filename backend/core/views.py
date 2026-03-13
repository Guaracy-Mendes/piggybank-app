# Import default Django storage system (handles saving files)
from django.core.files.storage import default_storage
# Utility to safely fetch a model instance or raise a 404 if not found
from django.shortcuts import get_object_or_404
# Built-in helper to check hashed passwords (compares raw vs. hashed)
from django.contrib.auth.hashers import check_password
# Database transaction helper (ensures atomic operations, rollback on errors)
from django.db import transaction
# Advanced query helpers: F allows field references, Q allows OR/AND filters
from django.db.models import F, Q
# Import Django project settings (for configs like Stripe API keys)
from django.conf import settings

# Django REST Framework core tools
from rest_framework.views import APIView                         # Base class for API endpoints
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAuthenticatedOrReadOnly
from rest_framework.parsers import MultiPartParser, FormParser   # For handling file uploads (form-data)
from rest_framework.response import Response                     # Used to send API responses
from rest_framework import status                                # HTTP status codes (200, 400, 201, etc.)
from rest_framework import permissions                          # Shortcut import for permissions
from rest_framework.pagination import PageNumberPagination       # Pagination base class

# Extra imports
from decimal import Decimal   # Work with precise numbers (money, etc.)
import uuid                   # Generate unique IDs
import stripe                 # Stripe payment library
from datetime import date     # Handle dates

# Import local serializers and models
from core import serializers as core_serializers
from userauths import serializers as userauths_serializers
from core import models as core_models
from userauths import models as userauths_models

# Set Stripe secret key from settings (so we can use Stripe API)
stripe.api_key = settings.STRIPE_SECRET_KEY


class StandardPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100

class FileUploadView(APIView):
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request, *args, **kwargs):
        serializer = core_serializers.FileUploadSerializer(data=request.data)

        if serializer.is_valid():
            uploaded_file = serializer.validated_data['file']

            file_name = default_storage.save(uploaded_file.name, uploaded_file)
            file_url = request.build_absolute_uri(default_storage.url(file_name))

            return Response(file_url, status=status.HTTP_201_CREATED)
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class VerificationAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        payment_id = request.data.get("paymentId")
        amount = request.data.get("amount")
        user = request.user

        if not all([payment_id, amount]):
            return Response (
                {"error": "Missing required payment data"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            intent = stripe.PaymentIntent.create(
                amount = int(amount * 100),
                currency="usd",
                payment_method=payment_id,
                confirm=True,
                automatic_payment_methods={"enabled": True, "allow_redirects": "never"},
                description=f"Wallet funding for {user.username}"
            )

            if intent.status != "succeeded":
                return Response(
                    {"error": "Stripe payment not successful"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            transaction_id = intent.id
        except stripe.error.CardError as e:
            return Response(
                {"error": f"Stripe card error: {e.user_message}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {"error": f"Stripe verification error: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        wallet, created = core_models.Wallet.objects.get_or_create(user=user)
        wallet.balance += amount
        wallet.save()

        transaction = core_models.Transaction.objects.create(
            wallet=wallet,
            transaction_type=core_models.Transaction.TransactionType.DEPOSIT, # deposit type
            amount=amount,
            status=core_models.Transaction.TransactionStatus.SUCCESSFUL,     # mark successful
            receiver=user,                                                   # who got the money
            external_reference=transaction_id,                               # Stripe payment reference
        )

        # Create a notification record so user sees "Deposit Successful"
        core_models.Notification.objects.create(
            user=user,
            transaction=transaction,
            status=core_models.Notification.TransactionType.DEPOSIT,
            title="New Deposit From Stripe",
            message=f"You funded your wallet with {amount} from stripe",
        )

        # Final response: tell frontend deposit worked, send new balance
        return Response(
            {
                "message": "Wallet funding successfull",
                "wallet_balance": wallet.balance
            },
            status=status.HTTP_200_OK
        )

class TransferFundsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = request.data or {}

        wallet_id = (data.get("wallet_id") or "").strip()
        raw_amount = (data.get("amount") or "").strip()
        pin = (data.get("transaction_pin") or "").strip()
        save_beneficiary = (data.get("save_beneficiary"))

        if not wallet_id or not raw_amount or not pin:
            return Response({"detail": "wallet_id, amount, transaction_pin are required"} , status=status.HTTP_400_BAD_REQUEST)
        
        try:
            amount = Decimal(raw_amount)
        except:
            return Response({"detail": "amount must be a valid decimal string"} , status=400)
        
        if amount <= Decimal("0.00"):
            return Response({"detail": "amount must be greater than 0"} , status=400)

        sender_user = request.user
        try:
            sender_wallet = sender_user.wallet
        except core_models.Wallet.DoesNotExist:
            return Response({"detail": "sender wallet not found"} , status=400)
        
        if not pin == sender_user.transaction_pin:
            return Response({"detail": "Invalid tranasaction pin"} , status=403)
        
        kyc = getattr(sender_user, "kyc_profile", None)
        if not kyc or kyc.verification_status != userauths_models.KYC.VerificationStatus.VERIFIED:
            return Response({"detail": "KYC not verified, completed to transfer funds"} , status=403)
        
        try:
            receiver_wallet = core_models.Wallet.objects.select_related("user").get(wallet_id=wallet_id)
        except:
            return Response({"detail": "Destination wallet not found"} , status=404)

        if receiver_wallet.user_id == sender_user.id:
            return Response({"detail": "You cannot transfer to your own wallet"} , status=400)


        wallet_ids = sorted([sender_wallet.id, receiver_wallet.id])
        transfer_group_id = uuid.uuid4

        with transaction.atomic():
            locked = (core_models.Wallet.objects.select_for_update().filter(id__in=wallet_ids).in_bulk(field_name="id"))
            s_wallet = locked[sender_wallet.id]
            r_wallet = locked[receiver_wallet.id]

            if s_wallet.balance < amount:
                return Response({"detail": "Insufficient funds"} , status=400)
            
            s_wallet.balance = (s_wallet.balance - amount).quantize(Decimal("0.01"))
            r_wallet.balance = (r_wallet.balance + amount).quantize(Decimal("0.01"))

            s_wallet.save(update_fields=["balance", "updated_at"])
            r_wallet.save(update_fields=["balance", "updated_at"])

            sender_tx = core_models.Transaction.objects.create(
                wallet=s_wallet,
                transaction_type=core_models.Transaction.TransactionType.TRANSFER,
                amount=amount,
                status=core_models.Transaction.TransactionStatus.SUCCESSFUL,
                sender=sender_user,
                receiver=receiver_wallet.user,
                external_reference=str(transfer_group_id),
            )
            receiver_tx = core_models.Transaction.objects.create(
                wallet=r_wallet,
                transaction_type=core_models.Transaction.TransactionType.TRANSFER,
                amount=amount,
                status=core_models.Transaction.TransactionStatus.SUCCESSFUL,
                sender=sender_user,
                receiver=receiver_wallet.user,
                external_reference=str(transfer_group_id),
            )

            if save_beneficiary:
                core_models.Beneficiary.objects.get_or_create(user=sender_user, beneficiary_user=receiver_wallet.user)

            core_models.Notification.objects.create(
                user=sender_user,
                transaction=sender_tx,
                status=core_models.Notification.TransactionType.TRANSFER,
                title="Transfer Sent",
                message=f"You sent ${amount} to {receiver_wallet.user.username} ({receiver_wallet.wallet_id}).",
            )
            core_models.Notification.objects.create(
                user=receiver_wallet.user,
                transaction=receiver_tx,
                status=core_models.Notification.TransactionType.TRANSFER,
                title="Transfer Received",
                message=f"You received ${amount} from {sender_user.username}.",
            )

            return Response(
                {
                    "transfer_id": str(sender_tx.reference),
                    "amount": f"{amount}",
                    "from": {
                        "user": sender_user.username,
                        "wallet_id": sender_wallet.wallet_id,
                        "new_balance": f"{s_wallet.balance}",
                    },
                    "to": {
                        "user": receiver_wallet.user.username,
                        "wallet_id": receiver_wallet.wallet_id,
                    },
                    "status": "SUCCESSFUL",
                },
                status=status.HTTP_201_CREATED,
            )

class WalletDetail(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, wallet_id):
        wallet = get_object_or_404(core_models.Wallet, wallet_id=wallet_id)
        kyc = userauths_models.KYC.objects.filter(user=wallet.user).first()

        if not kyc:
            return Response({"detail": "KYC not found for this wallet"} , status=status.HTTP_400_BAD_REQUEST)
        
        data = {
            "wallet_id": wallet.wallet_id,
            "full_name": kyc.full_name,
            "verification_status": kyc.verification_status,
        }

        return Response(data, status=status.HTTP_200_OK)

class BeneficiariesList(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        beneficiaries = core_models.Beneficiary.objects.filter(user=request.user)
        serializer = core_serializers.BeneficiarySerializer(beneficiaries, many=True)
        return Response(serializer.data)

class CreateSavingsGoalView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = request.data or {}

        name = (data.get("name") or "").strip()
        raw_target_amount = (data.get("target_amount") or "").strip()
        raw_target_date = (data.get("target_date") or "").strip()

        if not name or not raw_target_amount:
            return Response({"detail": "name and target_amounts are required"} , status=status.HTTP_400_BAD_REQUEST)
        
        try:
            target_amount = Decimal(raw_target_amount)
        except:
            return Response({"detail": "Target amount must be a valid decimal string"} , status=400)

        if target_amount <= Decimal("0"):
            return Response({"detail": "Target amount must be greater than 0"} , status=400)
        
        target_date = None
        if raw_target_date:
            try:
                target_date = date.fromisoformat(raw_target_date) # YYYY-MM-DD
            except ValueError:
                return Response({"detail": "Target date must be in YYYY-MM-DD format"} , status=400)
        
        try:
            wallet = request.user.wallet
        except:
            return Response({"detail": "Wallet not found for user"} , status=400)
        
        goal = core_models.SavingsGoal.objects.create(
            wallet=wallet,
            name=name,
            target_amount=target_amount,
            target_date=target_date
        )

        receiver_tx = core_models.Transaction.objects.create(
            wallet=request.user.wallet,
            transaction_type=core_models.Transaction.TransactionType.SAVINGS,
            amount=target_amount,
            status=core_models.Transaction.TransactionStatus.SUCCESSFUL,
            sender=request.user,
            receiver=request.user,
            external_reference=str(uuid.uuid4()),
        )

        core_models.Notification.objects.create(
            user=request.user,
            transaction=receiver_tx,
            status=core_models.Notification.TransactionType.TRANSFER,
            title="Saving Goal Created",
            message=f"You created a new saving goal.",
        )

        # Return a short summary the frontend can show
        return Response(
            {
                "uuid": str(goal.uuid), # Public-safe identifier for future operations
                "name": goal.name,
                "target_amount": f"{goal.target_amount}",
                "current_amount": f"{goal.current_amount}",
                "target_date": goal.target_date.isoformat() if goal.target_date else None,
            },
            status=status.HTTP_201_CREATED,
        )
    

class OverviewAPIVIew(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        wallet = user.wallet
        beneficiaries_count = core_models.Beneficiary.objects.filter(user=user).count()
        unread_notifications = core_models.Notification.objects.filter(user=user, is_read=False).count()
        
        recent_tx = core_models.Transaction.objects.filter(
            Q(wallet__user=user) | Q(sender=user) | Q(receiver=user)
        ).order_by("-timestamp")[:5]

        tx_serializer = core_serializers.TransactionSerializer(recent_tx, many=True)

        goals = core_models.SavingsGoal.objects.filter(wallet=wallet)

        goals_data = [
            {
                "uuid": str(g.uuid),
                "name": g.name,
                "target": float(g.target_amount),
                "current": float(g.current_amount),
                "progress": float(g.progress_percentage),
            }
            for g in goals
        ]

        return Response(
            {
                "wallet": {
                    "balance": float(wallet.balance),
                    "wallet_id": wallet.wallet_id,
                },
                "beneficiaries": beneficiaries_count,
                "unread_notifications": unread_notifications,
                "recent_transactions": tx_serializer.data,
                "savings_goals": goals_data,
            },
            status=200,
        )

class TransactionListAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        qs = core_models.Transaction.objects.select_related("wallet", "sender", "receiver").filter(
            Q(wallet__user=user) | Q(sender=user) | Q(receiver=user)
        )

        serializer = core_serializers.TransactionSerializer(qs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class TransactionDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, reference):
        user = request.user

        tx = get_object_or_404(core_models.Transaction, reference=reference)
        serializer = core_serializers.TransactionSerializer(tx)
        return Response(serializer.data, status=status.HTTP_200_OK)


class DepositToSavingsGoalView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = request.data or {}

        raw_uuid = data.get("uuid")
        raw_amount = data.get("amount")

        if not raw_uuid or not raw_amount:
            return Response({"detail", "uuid and amount are required"}, status=400)

        amount = Decimal(raw_amount)
        wallet = request.user.wallet

        with transaction.atomic():
            goal = core_models.SavingsGoal.objects.get(uuid=raw_uuid, wallet=wallet)

            if wallet.balance < amount:
                return Response({"detail", "Insufficient wallet funds"}, status=400)
            

            wallet.balance = (wallet.balance - amount).quantize(Decimal("0.01"))
            goal.current_amount = (goal.current_amount + amount).quantize(Decimal("0.01"))

            wallet.save(update_fields=["balance", "updated_at"])
            goal.save(update_fields=["current_amount"])

             # Create a transaction record to log this operation (useful for audit and history)
            tx = core_models.Transaction.objects.create(
                wallet=wallet,  # Reference the wallet that is involved in the transaction
                transaction_type=core_models.Transaction.TransactionType.SAVINGS,  # Categorize this as a "SAVINGS" transaction
                amount=amount,  # The amount being moved into the savings goal
                status=core_models.Transaction.TransactionStatus.SUCCESSFUL,  # Mark the transaction as successful
                sender=request.user,  # The user sending the money (this is an internal transaction for the same user)
                receiver=request.user,  # The receiver is the same user (as the goal is owned by the user)
                external_reference=str(goal.uuid),  # Link this transaction to the savings goal (for easy tracing)
            )

            # Optionally create a notification for the user to provide feedback about the operation
            core_models.Notification.objects.create(
                user=request.user,  # Notify the user who performed the action
                transaction=tx,  # Associate this notification with the transaction
                status=core_models.Notification.TransactionType.SAVINGS,  # Type of the notification (related to savings)
                title="Savings Deposit",  # Notification title
                message=f"${amount} moved from wallet to savings goal '{goal.name}'.",  # Detailed message to the user
            )

        # Respond with the updated wallet and goal details so the UI can refresh and display the new state
        return Response(
            {
                "goal_uuid": str(goal.uuid),  # The unique identifier of the savings goal
                "goal_name": goal.name,  # The name of the savings goal
                "wallet_new_balance": f"{wallet.balance}",  # The updated balance in the wallet
                "goal_new_current_amount": f"{goal.current_amount}",  # The updated current amount in the savings goal
                "status": "SUCCESSFUL",  # Indicate that the operation was successful
            },
            status=status.HTTP_201_CREATED,  # HTTP 201 Created status to indicate the operation was successful
        )



class WithdrawFromSavingsGoalView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = request.data or {}

        raw_uuid = data.get("uuid")
        wallet = request.user.wallet

        if not raw_uuid :
            return Response({"detail", "uuid is required"}, status=400)
        
        with transaction.atomic():
            goal = core_models.SavingsGoal.objects.get(uuid=raw_uuid, wallet=wallet)
            if goal.current_amount < goal.target_amount:
                return Response({"detail": "Cannot withdraw, goal not yet reached"}, status=400)
            
            amount = goal.current_amount

            if amount <= Decimal("0.00"):
                return Response({"detail", "Nothing to withdraw"}, status=400)
            
            wallet.balance = (wallet.balance + amount).quantize(Decimal("0.01"))
            goal.current_amount = Decimal("0.00")

            wallet.save()
            goal.save()

            # Create a transaction record for the withdrawal (helps in tracking the operation)
            tx = core_models.Transaction.objects.create(
                wallet=wallet,  # The wallet from which money is withdrawn
                transaction_type=core_models.Transaction.TransactionType.SAVINGS,  # Categorize the transaction as "SAVINGS"
                amount=amount,  # The amount withdrawn from the savings goal
                status=core_models.Transaction.TransactionStatus.SUCCESSFUL,  # Status: successful if no errors occurred
                sender=request.user,  # The user who initiated the withdrawal (sender)
                receiver=request.user,  # The user who receives the funds (receiver is the same as sender)
                external_reference=str(goal.uuid),  # Link this transaction to the goal for tracing purposes
            )

            # Optionally create a notification to inform the user of the successful withdrawal
            core_models.Notification.objects.create(
                user=request.user,  # Notify the user who initiated the withdrawal
                transaction=tx,  # Link the notification to the transaction
                status=core_models.Notification.TransactionType.SAVINGS,  # Set the notification type as "SAVINGS"
                title="Savings Withdrawal",  # Title for the notification
                message=f"${amount} withdrawn from savings goal '{goal.name}' to your wallet.",  # Inform the user of the withdrawal details
            )

        # Return a response with the updated balances and the status of the withdrawal operation
        return Response(
            {
                "goal_uuid": str(goal.uuid),  # The unique identifier for the goal
                "goal_name": goal.name,  # The name of the goal the funds were withdrawn from
                "withdrawn_amount": f"{amount}",  # The amount that was withdrawn
                "wallet_new_balance": f"{wallet.balance}",  # The updated balance in the user's wallet
                "goal_new_current_amount": f"{goal.current_amount}",  # The updated balance in the savings goal (should be 0)
                "status": "SUCCESSFUL",  # Indicate the withdrawal was successful
            },
            status=status.HTTP_201_CREATED,  # Return a "201 Created" status indicating the transaction was successful
        )


class SavingsGoalListAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        wallet = user.wallet
        goals = core_models.SavingsGoal.objects.filter(wallet=wallet).order_by("-created_at")

        data = [
            {
                "uuid": str(g.uuid),
                "name": g.name,
                "target_amount": float(g.target_amount),
                "current_amount": float(g.current_amount),
                "target_date": g.target_date.isoformat() if g.target_date else None,
                "progress_percentage": float(g.progress_percentage),
                "created_at": g.created_at.isoformat()
            }
            for g in goals
        ]

        return Response(data, status=200)
    

class SavingsGoalDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, uuid):
        user = request.user
        wallet = user.wallet
        goal = core_models.SavingsGoal.objects.get(wallet=wallet, uuid=uuid)

        txs = (
            core_models.Transaction.objects.filter(
                wallet=wallet, transaction_type=core_models.Transaction.TransactionType.SAVINGS,
                external_reference=str(goal.uuid)
            ).order_by("-timestamp")
        )

        items = []

        for tx in txs:
            notif = core_models.Notification.objects.filter(transaction=tx).order_by("-timestamp").first()
            kind = "SAVINGS"

            if notif:
                title = (notif.title or "").lower()
                if "deposit" in title:
                    kind = "DEPOSIT"
                elif "withdraw" in title:
                    kind = "WITHDRAWAL"
            
            items.append({
                "reference": str(tx.reference),  # Transaction reference
                "amount": float(tx.amount),  # Amount involved in the transaction
                "status": tx.status,  # Transaction status (e.g., PENDING, SUCCESSFUL)
                "timestamp": tx.timestamp.isoformat(),  # Transaction timestamp
                "kind": kind,  # Transaction kind ("DEPOSIT", "WITHDRAWAL")
            })

        data = {
            "goal": {
                "uuid": str(goal.uuid),  # Convert goal UUID to string
                "name": goal.name,  # Goal name
                "target_amount": float(goal.target_amount),  # Target savings amount
                "current_amount": float(goal.current_amount),  # Current saved amount
                "target_date": goal.target_date.isoformat() if goal.target_date else None,  # Target date
                "progress_percentage": float(goal.progress_percentage),  # Goal progress percentage
                "created_at": goal.created_at.isoformat(),  # Creation date of the goal
            },
            "wallet": {
                "wallet_id": wallet.wallet_id,  # Wallet ID
                "balance": float(wallet.balance),  # Wallet balance
            },
            "transactions": items,  # Include all the transactions related to this goal
        }

        # Return the detailed data as a JSON response with a 200 OK status
        return Response(data, status=200)


class BeneficiariesListAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = core_models.Beneficiary.objects.filter(user=request.user).order_by("-created_at")
        serializer = core_serializers.BeneficiarySerializer(qs, many=True)
        return Response(serializer.data, status=200)
    
class BeneficiaryDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        b = get_object_or_404(core_models.Beneficiary, pk=pk, user=request.user)
        b.delete()
        return Response({"detail": "Beneficiary deleted"}, status=204)
    

class BeneficiaryCreateAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        wallet_id = request.data.get("wallet_id")
        target_wallet = core_models.Wallet.objects.get(wallet_id=wallet_id)

        obj, created = core_models.Beneficiary.objects.get_or_create(
            user=request.user,
            beneficiary_user=target_wallet.user
        )

        kyc = getattr(target_wallet.user, "kyc_profile", None)
        name = getattr(kyc, "full_name", None) or target_wallet.user.username or target_wallet.user.email

        data = {
            "id": obj.id,
            "email": target_wallet.user.email,
            "name": name,
            "wallet_id": target_wallet.wallet_id,
            "created_at": obj.created_at.isoformat()
        }

        return Response(data, status=status.HTTP_201_CREATED)
    
class NotificationListAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        qs = core_models.Notification.objects.filter(user=user, is_read=False).order_by("-timestamp")

        data = []

        for n in qs:
            tx = n.transaction

            data.append({
                "id": n.id,                                # Notification ID
                "title": n.title,                          # Notification title
                "message": n.message,                      # Notification message content
                "type": n.status,                          # Type of notification (DEPOSIT, TRANSFER, etc.)
                "is_read": n.is_read,                      # Whether the notification has been read
                "timestamp": n.timestamp.isoformat(),      # Timestamp of when the notification was created
                "tx_reference": str(tx.reference) if tx else None,  # Transaction reference (if a transaction exists)
                "tx_status": tx.status if tx else None,    # Transaction status (PENDING, SUCCESSFUL, FAILED, etc.)
            })
        
        # Return the list of notifications as the response, with a 200 status code
        return Response(data, status=200)


class NotificationMarkReadAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        user = request.user
        n = core_models.Notification.objects.get(id=pk, user=user)
        n.is_read = True
        n.save()
        return Response({"id": n.id, "is_read": n.is_read})
    
class NotificationMarkAllReadAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        core_models.Notification.objects.filter(user=user, is_read=False).update(is_read=True)
        return Response({"detail": "All notifications marked as read"}, status=200)