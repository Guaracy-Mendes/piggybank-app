import apiClient from "./apiClient";

export const verifyWalletFunding = (payload: { paymentId: string; amount: number }) => {
    return apiClient.post("core/verify/", payload);
};

export const getWalletDetail = ({ wallet_id }) => {
    return apiClient.get(`core/wallet/${wallet_id}/`);
};

export const getBeneficiaries = () => {
    return apiClient.get(`core/beneficiaries/`);
};

export const transferFunds = ({ wallet_id, amount, transaction_pin, save_beneficiary = false }) => {
    return apiClient.post("core/transfer/", { wallet_id, amount, transaction_pin, save_beneficiary });
};

export const createSavingsGoal = ({ name, target_amount, target_date = null }) => {
    return apiClient.post("core/savings-goals/create/", {
        name,
        target_amount,
        ...(target_date ? { target_date } : {}),
    });
};

export const getOverview = () => {
    return apiClient.get("core/overview/");
};

export const getTransactions = () => {
    return apiClient.get("core/transactions/");
};

/** Get a single transaction by UUID reference */
export const getTransaction = (reference: string) => {
    return apiClient.get(`core/transactions/${reference}/`);
};

export const depositToSavingsGoal = ({ uuid, amount }) => {
    // Send a POST request to deposit the specified `amount` into the savings goal identified by `uuid`.
    return apiClient.post("core/savings-goals/deposit/", {
        uuid, // The UUID of the savings goal
        amount, // The amount to be deposited into the goal
    });
};

// Function to withdraw funds from a specific savings goal.
export const withdrawFromSavingsGoal = ({ uuid }) => {
    // Send a POST request to withdraw the entire balance from the savings goal identified by `uuid`.
    return apiClient.post("core/savings-goals/withdraw/", {
        uuid, // The UUID of the savings goal
    });
};

export const getSavingsGoals = () => {
    return apiClient.get("core/savings-goals/");
};

export const getSavingsGoal = (uuid: string) => {
    return apiClient.get(`core/savings-goals/${uuid}/`);
};

// Function to delete a beneficiary from the list.
export const deleteBeneficiary = (id: number | string) => {
    // Send a DELETE request to remove the beneficiary identified by `id`.
    return apiClient.delete(`core/beneficiaries/${id}/`); // Endpoint "core/beneficiaries/{id}/" removes a beneficiary by their ID
};

// Function to add a new beneficiary by sending a POST request with a `wallet_id`.
export const addBeneficiary = ({ wallet_id }: { wallet_id: string }) => {
    // Send a POST request to add a new beneficiary using the provided wallet ID.
    return apiClient.post("core/beneficiaries/add/", { wallet_id }); // `wallet_id` is used to identify the beneficiary to add
};


// Function to retrieve notifications, optionally filtered by `unread` status.
export const getNotifications = () => {
    // Send a GET request to fetch notifications with optional parameters (e.g., unread notifications only).
    return apiClient.get("core/notifications/"); // 
};

// Function to mark a specific notification as read by its ID.
export const markNotificationRead = (id: number) => {
    // Send a POST request to mark the notification with the given `id` as read.
    return apiClient.post(`core/notifications/${id}/read/`); // `id` specifies the notification to mark as read
};

// Function to mark all notifications as read.
export const markAllNotificationsRead = () => {
    // Send a POST request to mark all notifications as read.
    return apiClient.post("core/notifications/read-all/"); // This marks every notification as read in the backend
};