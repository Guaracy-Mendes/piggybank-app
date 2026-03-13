import { DesktopSidebar, MobileSidebar } from "@/layout/Sidebar";
import DashboardHeader from "@/layout/DashboardHeader";
import { Bell, CheckCircle2, Clock, XCircle, ArrowRight, Check } from "lucide-react";
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "@/libs/core";
import { Link } from "react-router-dom";
import React, { useEffect } from "react";
import { toast } from "sonner";

const Notifications = () => {
    // State hooks to manage loading, notifications data, errors, toasts, filters, and busy state
    const [loading, setLoading] = React.useState(true); // For loading state
    const [items, setItems] = React.useState([]); // For storing the list of notifications
    const [error, setError] = React.useState(""); // For storing any error message
    const [onlyUnread, setOnlyUnread] = React.useState(false); // For managing whether only unread notifications should be shown
    const [busyAll, setBusyAll] = React.useState(false); // For managing the state of marking all notifications as read

    async function load() {
        try {
            setLoading(true);
            setError("");
            const { data } = await getNotifications();
            setItems(data);
        } catch (error) {
            console.log(error);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
    }, []);

    async function handleMarkOne(id: number) {
        try {
            await markNotificationRead(id);
            await load();
            toast.success("Marked as read");
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Failed to mark as read");
        }
    }

    async function handleMarkAll() {
        try {
            await markAllNotificationsRead();
            await load();
            toast.success("Marked all notifications as read");
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Failed to mark as read");
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

                    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
                        {/* Header row */}
                        <div className="mb-6 flex items-center justify-between">
                            <div>
                                <h1 className="text-lg font-semibold">Notifications</h1>
                                <p className="text-sm text-gray-600 dark:text-white/60">Latest updates on your transactions and activity.</p>
                            </div>

                            {/* Mark all as read (UI only) */}
                            <button onClick={handleMarkAll} type="button" className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm transition hover:bg-gray-50 dark:border-white/10 dark:bg-transparent dark:text-white dark:hover:bg-white/5" title="Mark all as read">
                                <Check className="h-4 w-4" />
                                Mark all as read
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Success example */}
                            {items?.map((n) => (
                                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-white/10 dark:bg-white/5">
                                    <div className="flex items-start gap-3">
                                        <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl border border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-black/40">
                                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-sm font-medium">{n.title}</h3>
                                                <span className="text-xs text-gray-500 dark:text-white/60">{new Date(n.timestamp).toLocaleString()}</span>
                                            </div>
                                            <p className="mt-1 text-sm text-gray-600 dark:text-white/70">{n?.message}</p>
                                            <div className="mt-2 flex items-center gap-3">
                                                {n?.tx_reference && (
                                                    <Link to={`/dashboard/transactions/${n?.tx_reference}`} className="inline-flex items-center gap-1 text-xs font-medium text-gray-900 underline-offset-4 hover:underline dark:text-white">
                                                        View transaction <ArrowRight className="h-3 w-3" />
                                                    </Link>
                                                )}
                                                {/* Per-card mark as read (UI only) */}
                                                <button onClick={() => handleMarkOne(n.id)} className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900 dark:text-white/70 dark:hover:text-white">
                                                    <Check className="h-3 w-3" />
                                                    Mark as read
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Footer note */}
                        <div className="mt-6 text-center text-xs text-gray-500 dark:text-white/60">You’re all caught up 🎉</div>
                    </main>
                </div>
            </div>
        </div>
    );
};

export default Notifications;
