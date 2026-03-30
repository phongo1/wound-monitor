import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Activity, LogOut, Monitor, Users } from "lucide-react";

import { isSupabaseConfigured, supabase } from "../lib/supabase";
import LandingPage from "./components/LandingPage";
import LoginPage from "./components/LoginPage";
import MonitorTab from "./components/MonitorTab";
import PatientsTab from "./components/PatientsTab";
import SignupPage from "./components/SignupPage";
import type { Patient } from "./components/PatientsTab";

type Page = "landing" | "login" | "signup";
type Tab = "patients" | "monitor";

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>("landing");
  const [currentTab, setCurrentTab] = useState<Tab>("patients");
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [patients, setPatients] = useState<Patient[]>([]);

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }

    let isMounted = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) {
        return;
      }

      setSession(data.session);
      setAuthReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);

      if (!nextSession) {
        setPatients([]);
        setCurrentTab("patients");
        setCurrentPage("landing");
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    if (!supabase) {
      setSession(null);
      setPatients([]);
      setCurrentTab("patients");
      setCurrentPage("landing");
      return;
    }

    await supabase.auth.signOut();
  };

  const handleAddPatient = (patient: Omit<Patient, "id">) => {
    const newPatient: Patient = {
      ...patient,
      id: Date.now().toString(),
    };
    setPatients([...patients, newPatient]);
  };

  const userEmail = session?.user.email ?? "";
  const userDisplayName =
    session?.user.user_metadata?.full_name ?? userEmail ?? "Clinician";

  if (!authReady) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Restoring session...</p>
      </div>
    );
  }

  if (session) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="px-8 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-gray-900">WoundCare</h1>
                <p className="text-gray-600">Welcome, {userDisplayName}</p>
              </div>
            </div>
            <button
              onClick={() => {
                void handleLogout();
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          </div>
        </header>

        <div className="flex-1 flex">
          <nav className="bg-white border-r border-gray-200 w-64 p-4">
            <div className="space-y-2">
              <button
                onClick={() => setCurrentTab("patients")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  currentTab === "patients"
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <Users className="w-5 h-5" />
                <span>Patients</span>
              </button>
              <button
                onClick={() => setCurrentTab("monitor")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  currentTab === "monitor"
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <Monitor className="w-5 h-5" />
                <span>Monitor</span>
              </button>
            </div>
          </nav>

          <main className="flex-1 overflow-auto">
            {currentTab === "patients" && (
              <PatientsTab patients={patients} onAddPatient={handleAddPatient} />
            )}
            {currentTab === "monitor" && <MonitorTab patients={patients} />}
          </main>
        </div>
      </div>
    );
  }

  if (currentPage === "landing") {
    return <LandingPage onGetStarted={() => setCurrentPage("login")} />;
  }

  if (currentPage === "login") {
    return <LoginPage onSwitchToSignup={() => setCurrentPage("signup")} />;
  }

  if (currentPage === "signup") {
    return <SignupPage onSwitchToLogin={() => setCurrentPage("login")} />;
  }

  return null;
}
