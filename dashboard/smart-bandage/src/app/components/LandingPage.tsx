import { Activity, ArrowRight } from "lucide-react";
import heroGraphic from "../../assets/landingPage.png";

interface LandingPageProps {
    onGetStarted: () => void;
}

export default function LandingPage({ onGetStarted }: LandingPageProps) {
    return (
        <div className="min-h-screen bg-white flex flex-col">
            {/* Header */}
            <header className="px-8 py-6 border-b border-gray-100">
                <div className="flex items-center gap-2">
                    <Activity className="w-6 h-6 text-blue-600" />
                    <span className="text-gray-900">WoundCare</span>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 flex items-center justify-center">
                <div className="max-w-6xl mx-auto px-8 py-16 grid md:grid-cols-2 gap-12 items-center">
                    {/* Left: Content */}
                    <div className="space-y-6">
                        <h1 className="text-5xl md:text-6xl text-gray-900 leading-tight">
                            Monitor wounds.
                            <br />
                            Prevent infections.
                        </h1>

                        <p className="text-lg text-gray-600 leading-relaxed">
                            Track wound temperatures in real-time and catch
                            early signs of infection before they escalate.
                        </p>

                        <button
                            onClick={onGetStarted}
                            className="bg-blue-600 text-white px-8 py-4 rounded-lg hover:bg-blue-700 transition-all inline-flex items-center gap-2 group"
                        >
                            Get Started
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>

                    {/* Right: Health Monitor Graphic */}
                    <div className="relative">
                        <div className="rounded-2xl overflow-hidden">
                            <img
                                src={heroGraphic}
                                alt="Wearable health monitor tracking vital signs"
                                className="w-full h-full object-contain"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
