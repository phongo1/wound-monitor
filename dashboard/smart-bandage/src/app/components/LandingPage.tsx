import {
    Activity,
    ArrowRight,
    BellRing,
    ShieldCheck,
    Thermometer,
} from "lucide-react";
import heroGraphic from "../../assets/landingPage.png";
import React from "react";

interface LandingPageProps {
    onGetStarted: () => void;
}

const focusPoints = [
    {
        icon: ShieldCheck,
        label: "Infection prevention",
    },
    {
        icon: BellRing,
        label: "Early alerting",
    },
    {
        icon: Thermometer,
        label: "Continuous sensing",
    },
];

export default function LandingPage({ onGetStarted }: LandingPageProps) {
    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.16),_transparent_35%),linear-gradient(180deg,_#f8fbff_0%,_#ffffff_42%,_#f4f8fc_100%)] flex flex-col">
            {/* Header */}
            <header className="px-6 py-6 border-b border-white/70 backdrop-blur-sm md:px-8">
                <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <Activity className="w-6 h-6 text-blue-600" />
                        <span className="text-gray-900">WoundCare</span>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex items-center">
                <div className="mx-auto flex max-w-6xl flex-col gap-14 px-6 py-16 xl:flex-row xl:items-center xl:gap-20 md:px-8">
                    {/* Left: Content */}
                    <div className="min-w-0 flex-1 space-y-8 xl:basis-[42%]">
                        <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/80 px-4 py-2 text-sm text-blue-700 shadow-sm shadow-blue-100/70">
                            <ShieldCheck className="w-4 h-4" />
                            Early alerts for infection risk
                        </div>

                        <div className="space-y-6">
                            <h1 className="max-w-[11ch] text-[clamp(2.7rem,11vw,4rem)] leading-[0.92] tracking-[-0.05em] text-gray-900">
                                <span className="block">Monitor wounds.</span>
                                <span className="block">Prevent infections.</span>
                            </h1>

                            <p className="max-w-xl text-lg leading-8 text-gray-600 md:text-xl">
                                WoundCare turns wound temperature changes into earlier alerts,
                                helping clinicians catch infection risk sooner and respond before
                                recovery starts to slip.
                            </p>
                        </div>

                        <div className="flex flex-col gap-4 sm:flex-row">
                            <button
                                onClick={onGetStarted}
                                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-8 py-4 text-white shadow-lg shadow-blue-200/70 transition-all hover:bg-blue-700"
                            >
                                Get Started
                                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                            </button>
                        </div>

                        <div className="grid gap-5 sm:grid-cols-3">
                            {focusPoints.map(({ icon: Icon, label }) => (
                                <div
                                    key={label}
                                    className="flex items-center gap-3 rounded-2xl border border-white/80 bg-white/90 px-4 py-4 text-[.9em] text-gray-700 shadow-sm"
                                >
                                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50">
                                        <Icon className="w-4 h-4 text-blue-600" />
                                    </div>
                                    <span>{label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right: Health Monitor Graphic */}
                    <div className="flex-1 rounded-2xl xl:basis-[58%]">
                        <img
                            src={heroGraphic}
                            alt="Wearable health monitor tracking vital signs"
                            className="h-full w-full object-contain xl:scale-110"
                        />
                    </div>
                </div>
            </main>
        </div>
    );
}
