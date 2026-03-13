// src/pages/dashboard/Overview.tsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Menu, Wallet as WalletIcon, Send, Shield, Users, Bell, Settings, ChartBarBig, ArrowRight } from "lucide-react";
import { DesktopSidebar, MobileSidebar, SidebarTrigger } from "@/layout/Sidebar";
import ThemeToggleButton from "@/components/ThemeToggleButton";
import DashboardHeader from "@/layout/DashboardHeader";
import { getOverview } from "@/libs/core";

const Overview: React.FC = () => {
    const [overview, setOverview] = useState<any>({});

    const progress = (g: any) => Math.min(100, Math.round((g.current / g.target) * 100));

    useEffect(() => {
        (async () => {
            try {
                const { data } = await getOverview();
                setOverview(data);
            } catch (error) {
                console.log(error);
            }
        })();
    }, []);

    return (
        <div className="min-h-screen bg-white text-gray-900 antialiased dark:bg-[#0a0a0a] dark:text-white">
            <div className="flex">
                {/* Desktop sidebar */}
                <DesktopSidebar />

                {/* Mobile off-canvas (self-managed) */}
                <MobileSidebar />

                {/* Main */}
                <div className="flex min-h-screen flex-1 flex-col">
                    {/* Header */}
                    <DashboardHeader />

                    {/* Content */}
                    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
                        {/* ... keep your cards/tables exactly as you had ... */}
                        {/* (I left your existing UI unchanged below) */}

                        {/* Top summary cards */}
                        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm text-gray-600 dark:text-white/60">Wallet Balance</div>
                                        <div className="mt-2 text-3xl font-semibold">${overview?.wallet?.balance?.toFixed(2)}</div>
                                    </div>
                                    <div className="grid h-11 w-11 place-items-center rounded-xl border border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-black/40">
                                        <WalletIcon className="h-5 w-5" />
                                    </div>
                                </div>
                                <div className="mt-4 flex flex-wrap gap-2">
                                    <Link to="/dashboard/transfers/new" className="rounded-xl bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-95 dark:bg-white dark:text-black">
                                        Transfer
                                    </Link>
                                    <Link to="/dashboard/withdraw" className="rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 hover:bg-gray-50 dark:border-white/10 dark:bg-transparent dark:text-white dark:hover:bg-white/5">
                                        Withdraw
                                    </Link>
                                    <Link to="/dashboard/fund" className="rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 hover:bg-gray-50 dark:border-white/10 dark:bg-transparent dark:text-white dark:hover:bg-white/5">
                                        Fund
                                    </Link>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm text-gray-600 dark:text-white/60">Savings Goals</div>
                                        <div className="mt-2 text-3xl font-semibold">{overview?.savings_goals?.length}</div>
                                        <div className="mt-2 text-xs text-gray-600 dark:text-white/60">Track progress & automate deposits</div>
                                    </div>
                                    <div className="grid h-11 w-11 place-items-center rounded-xl border border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-black/40">
                                        <Shield className="h-5 w-5" />
                                    </div>
                                </div>
                                <div className="mt-4">
                                    <Link to="/dashboard/savings/new" className="inline-flex items-center gap-2 text-xs font-semibold text-gray-900 underline-offset-4 hover:underline dark:text-white">
                                        Create goal <ArrowRight className="h-4 w-4" />
                                    </Link>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm text-gray-600 dark:text-white/60">Beneficiaries</div>
                                        <div className="mt-2 text-3xl font-semibold">{overview?.beneficiaries}</div>
                                        <div className="mt-2 text-xs text-gray-600 dark:text-white/60">{overview?.unread_notifications} unread notifications</div>
                                    </div>
                                    <div className="grid h-11 w-11 place-items-center rounded-xl border border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-black/40">
                                        <Users className="h-5 w-5" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Savings grid */}
                        <section className="mt-8">
                            <div className="mb-3 flex items-center justify-between">
                                <h2 className="text-lg font-semibold">Your Saving Goals</h2>
                                <Link to="/dashboard/savings" className="text-sm text-gray-900 underline-offset-4 hover:underline dark:text-white">
                                    View all
                                </Link>
                            </div>
                            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                                {overview?.savings_goals?.map((g) => (
                                    <div key={g.id} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <div className="text-sm text-gray-600 dark:text-white/60">Goal</div>
                                                <div className="mt-1 font-medium">{g.name}</div>
                                            </div>
                                            <div className="grid h-9 w-9 place-items-center rounded-lg border border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-black/40">
                                                <ChartBarBig className="h-5 w-5" />
                                            </div>
                                        </div>
                                        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
                                            <div className="h-full rounded-full bg-gray-900 dark:bg-white" style={{ width: `${progress(g)}%` }} />
                                        </div>
                                        <div className="mt-2 flex items-center justify-between text-xs text-gray-600 dark:text-white/60">
                                            <span>${g.current.toLocaleString()} saved</span>
                                            <span>Target ${g.target.toLocaleString()}</span>
                                        </div>
                                        <div className="mt-4 flex gap-2">
                                            <Link to={`/dashboard/savings/${g.id}`} className="rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 hover:bg-gray-50 dark:border-white/10 dark:bg-transparent dark:text-white dark:hover:bg-white/5">
                                                Manage
                                            </Link>
                                            <Link to={`/dashboard/savings/${g.id}/deposit`} className="rounded-xl bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-95 dark:bg-white dark:text-black">
                                                Deposit
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* Recent transactions */}
                        <section className="mt-8">
                            <div className="mb-3 flex items-center justify-between">
                                <h2 className="text-lg font-semibold">Recent Transactions</h2>
                                <Link to="/dashboard/transactions" className="text-sm text-gray-900 underline-offset-4 hover:underline dark:text-white">
                                    View all
                                </Link>
                            </div>

                            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-white/5">
                                <table className="min-w-full text-sm">
                                    <thead className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-white/10 dark:text-white/60">
                                        <tr>
                                            <th className="px-4 py-3">Type</th>
                                            <th className="px-4 py-3">Amount</th>
                                            <th className="px-4 py-3">Status</th>
                                            <th className="px-4 py-3">Time</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {overview?.recent_transactions?.map((t) => (
                                            <tr key={t.id} className="border-t border-gray-100 dark:border-white/10">
                                                <td className="px-4 py-3">
                                                    <span className="inline-flex items-center gap-2">
                                                        <span className={`h-1.5 w-1.5 rounded-full ${t.type === "DEPOSIT" ? "bg-emerald-500/90" : t.type === "TRANSFER" ? "bg-indigo-500/90" : t.type === "WITHDRAWAL" ? "bg-rose-500/90" : t.type === "SAVINGS" ? "bg-amber-500/90" : "bg-gray-500/90"}`} />
                                                        {t.transaction_type}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 font-medium">${t.amount}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium`}>{t.status}</span>
                                                </td>
                                                <td className="px-4 py-3 text-gray-600 dark:text-white/60">{new Date(t.timestamp).toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>

                        {/* Final CTA row */}
                        <section className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
                            <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
                                <div className="text-sm text-gray-600 dark:text-white/60">Send money fast</div>
                                <div className="mt-2 text-lg font-semibold">Transfer</div>
                                <Link to="/dashboard/transfers/new" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-gray-900 underline-offset-4 hover:underline dark:text-white">
                                    Start transfer <ArrowRight className="h-4 w-4" />
                                </Link>
                            </div>
                            <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
                                <div className="text-sm text-gray-600 dark:text-white/60">Save automatically</div>
                                <div className="mt-2 text-lg font-semibold">Create Goal</div>
                                <Link to="/dashboard/savings/new" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-gray-900 underline-offset-4 hover:underline dark:text-white">
                                    New goal <ArrowRight className="h-4 w-4" />
                                </Link>
                            </div>
                            <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
                                <div className="text-sm text-gray-600 dark:text-white/60">Fuel your account</div>
                                <div className="mt-2 text-lg font-semibold">Fund Wallet</div>
                                <Link to="/dashboard/fund" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-gray-900 underline-offset-4 hover:underline dark:text-white">
                                    Add funds <ArrowRight className="h-4 w-4" />
                                </Link>
                            </div>
                        </section>
                    </main>
                </div>
            </div>
        </div>
    );
};

export default Overview;
