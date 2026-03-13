import { Link, useParams } from "react-router-dom";
import { DesktopSidebar, MobileSidebar } from "@/layout/Sidebar";
import DashboardHeader from "@/layout/DashboardHeader";
import { ArrowLeft, PiggyBank, PlusCircle, X, Wallet, DollarSign, Lock } from "lucide-react";
import { getSavingsGoal, depositToSavingsGoal, withdrawFromSavingsGoal } from "@/libs/core";
import { useState, useEffect } from "react";
import { toast } from "sonner";

type Goal = {
    uuid: string;
    name: string;
    target_amount: number;
    current_amount: number;
    target_date: string | null;
    progress_percentage: number;
    created_at: string;
};

type WalletLite = {
    wallet_id: string; // Unique identifier for the wallet
    balance: number; // Current balance in the wallet
};

const SavingsGoalDetail = () => {
    // Destructure `uuid` from the URL parameters
    const { uuid } = useParams();
    console.log(uuid);

    // State management for loading, error, goal, and wallet data
    const [loading, setLoading] = useState(true); // State to track loading status
    const [err, setErr] = useState(""); // State to store error message
    const [goal, setGoal] = useState<Goal | null>(null); // State to store the goal data
    const [wallet, setWallet] = useState<WalletLite | null>(null); // State to store wallet data

    // Deposit modal state
    const [amount, setAmount] = useState(""); // State for the deposit amount input
    const [busy, setBusy] = useState(false); // State to track if an operation is in progress (deposit/withdraw)

    async function fetchGoal() {
        if (!uuid) return;

        try {
            setLoading(true);
            setErr("");
            const { data } = await getSavingsGoal(uuid);
            setGoal(data);
            setWallet(data?.wallet ?? null);
        } catch (error) {
            console.log(error);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchGoal();
    }, []);

    async function handleDeposit() {
        if (!uuid || !amount) {
            toast.warning("Enter an amount");
            return;
        }

        try {
            setBusy(true);
            await depositToSavingsGoal({ uuid, amount });
            setAmount("");
            const checkbox = document.getElementById("deposit-modal") as HTMLInputElement | null;
            if (checkbox) checkbox.checked = false;
            await fetchGoal();
            toast.success("Deposit successful");
        } catch (error) {
            console.log(error);
        } finally {
            setBusy(false);
        }
    }

    async function handleWithdraw() {
        if (!uuid) {
            return;
        }

        try {
            setBusy(true);
            await withdrawFromSavingsGoal({ uuid });
            await fetchGoal();
            toast.success("Withdrawal successful");
        } catch (error) {
            console.log(error);
            toast.error("You cannot withdraw yet");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="min-h-screen bg-white text-gray-900 antialiased dark:bg-[#0a0a0a] dark:text-white">
            <div className="flex">
                {/* Sidebar */}
                <DesktopSidebar />
                <MobileSidebar />

                {/* Main */}
                <div className="flex min-h-screen flex-1 flex-col">
                    <DashboardHeader />

                    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
                        {/* Top bar */}
                        <div className="mb-6 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Link to="/dashboard/savings" className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-white">
                                    <ArrowLeft className="h-4 w-4" />
                                    Back
                                </Link>
                            </div>

                            {/* Modal toggle (checkbox) */}
                            <input id="deposit-modal" type="checkbox" className="peer/deposit hidden" />

                            {/* Deposit trigger */}
                            <div className="flex gap-3 items-center">
                                <label htmlFor="deposit-modal" className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:opacity-95 dark:bg-white dark:text-black">
                                    <PlusCircle className="h-4 w-4" /> Deposit
                                </label>

                                <button onClick={handleWithdraw} className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:bg-transparent dark:text-white dark:hover:bg-white/5">
                                    {busy ? "Withdrawing..." : "Withdraw"}
                                </button>
                            </div>
                            {/* Modal (pure CSS / no JS) */}
                            <div
                                className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center bg-black/0 p-4 opacity-0 transition
                           peer-checked/deposit:pointer-events-auto peer-checked/deposit:bg-black/40 peer-checked/deposit:opacity-100"
                            >
                                <label htmlFor="deposit-modal" className="absolute inset-0" aria-hidden="true" />

                                <div
                                    className="relative w-full max-w-md -translate-y-62 rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl transition
                             dark:border-white/10 dark:bg-[#101113]
                             peer-checked/deposit:translate-y-0"
                                    role="dialog"
                                    aria-modal="true"
                                    aria-labelledby="deposit-title"
                                >
                                    {/* Close */}
                                    <label htmlFor="deposit-modal" className="absolute right-3 top-3 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-white" aria-label="Close modal">
                                        <X className="h-4 w-4" />
                                    </label>

                                    <div className="mb-4 flex items-center gap-2">
                                        <div className="grid h-10 w-10 place-items-center rounded-xl border border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-black/40">
                                            <PiggyBank className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <h3 id="deposit-title" className="text-base font-semibold">
                                                Deposit into “{goal?.goal?.name}”
                                            </h3>
                                            <p className="text-xs text-gray-600 dark:text-white/60">Move money from your wallet to this goal.</p>
                                        </div>
                                    </div>

                                    {/* Wallet balance */}
                                    <div className="mb-4 rounded-2xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-white/10 dark:bg-black/40">
                                        <div className="flex items-center gap-2 text-gray-700 dark:text-white/80">
                                            <Wallet className="h-4 w-4" />
                                            <span>Wallet balance:</span>
                                            <span className="font-semibold">${wallet?.balance}</span>
                                        </div>
                                    </div>

                                    {/* Form fields (UI only) */}
                                    <div className="space-y-4">
                                        <div>
                                            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-white/70">Amount</label>
                                            <div className="relative">
                                                <DollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-white/50" />
                                                <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="w-full rounded-xl border border-gray-300 bg-white px-9 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-gray-400 dark:border-white/10 dark:bg-transparent dark:text-white" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="mt-5 flex items-center justify-end gap-2">
                                        <label htmlFor="deposit-modal" className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-50 dark:border-white/10 dark:bg-transparent dark:text-white dark:hover:bg-white/5">
                                            Cancel
                                        </label>
                                        <button onClick={handleDeposit} type="button" className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95 dark:bg-white dark:text-black">
                                            {busy ? "Processing" : "Deposit"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Goal summary card */}
                        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h1 className="text-lg font-semibold">{goal?.goal?.name}</h1>
                                    <p className="mt-1 text-sm text-gray-600 dark:text-white/60">
                                        Target: ${goal?.goal?.target_amount} • Saved: ${goal?.goal?.current_amount}
                                    </p>
                                </div>
                                <div className="grid h-12 w-12 place-items-center rounded-xl border border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-black/40">
                                    <PiggyBank className="h-6 w-6" />
                                </div>
                            </div>

                            {/* Progress bar */}
                            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
                                <div className="h-full rounded-full bg-indigo-600 dark:bg-white" style={{ width: `${Math.min(100, Math.max(0, goal?.goal?.progress_percentage ?? 0))}%` }} />
                            </div>
                            <div className="mt-2 text-sm text-gray-600 dark:text-white/60">
                                {Math.round(goal?.goal?.progress_percentage ?? 0)}% completed • Target date: {goal?.goal?.target_date}
                            </div>
                        </div>

                        {/* Transactions list (static UI) */}
                        <section className="mt-8">
                            <h2 className="mb-3 text-lg font-semibold">Goal Transactions</h2>
                            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-white/5">
                                <table className="min-w-full text-sm">
                                    <thead className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-white/10 dark:text-white/60">
                                        <tr>
                                            <th className="px-4 py-3">Date</th>
                                            <th className="px-4 py-3">Type</th>
                                            <th className="px-4 py-3">Amount</th>
                                            <th className="px-4 py-3">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {goal?.transactions?.map((tx) => (
                                            <tr className="border-t border-gray-100 dark:border-white/10">
                                                <td className="px-4 py-3">{new Date(tx.timestamp).toLocaleString()}</td>
                                                <td className="px-4 py-3">{tx?.kind}</td>
                                                <td className="px-4 py-3 font-medium text-emerald-600 dark:text-emerald-400">+ ${tx?.amount}</td>
                                                <td className="px-4 py-3">
                                                    <span className="inline-flex rounded-full bg-black text-white px-2 py-0.5 text-xs font-medium ">{tx?.status}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    </main>
                </div>
            </div>
        </div>
    );
};

export default SavingsGoalDetail;
