import { useState } from "react";
import { Calendar, Plus, User } from "lucide-react";

import type { CreatePatientInput, Patient } from "../../lib/api";

interface PatientsTabProps {
  patients: Patient[];
  isLoading: boolean;
  errorMessage: string;
  onAddPatient: (patient: CreatePatientInput) => Promise<void>;
}

export default function PatientsTab({
  patients,
  isLoading,
  errorMessage,
  onAddPatient,
}: PatientsTabProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [woundType, setWoundType] = useState("");
  const [admissionDate, setAdmissionDate] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !age || !woundType || !admissionDate) {
      return;
    }

    setSubmitError("");
    setIsSubmitting(true);

    try {
      await onAddPatient({
        name,
        age: parseInt(age, 10),
        woundType,
        admissionDate,
      });
      setName("");
      setAge("");
      setWoundType("");
      setAdmissionDate("");
      setShowAddForm(false);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to add patient.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-gray-900 mb-1">Patient Management</h2>
            <p className="text-gray-600">Manage patients under your care</p>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Patient
          </button>
        </div>

        {errorMessage && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {showAddForm && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h3 className="text-gray-900 mb-4">Add New Patient</h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="patientName" className="block text-gray-700 mb-2">
                  Patient Name
                </label>
                <input
                  id="patientName"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="John Doe"
                  required
                />
              </div>

              <div>
                <label htmlFor="age" className="block text-gray-700 mb-2">
                  Age
                </label>
                <input
                  id="age"
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="45"
                  required
                />
              </div>

              <div>
                <label htmlFor="woundType" className="block text-gray-700 mb-2">
                  Wound Type
                </label>
                <select
                  id="woundType"
                  value={woundType}
                  onChange={(e) => setWoundType(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Select type</option>
                  <option value="Surgical">Surgical</option>
                  <option value="Burn">Burn</option>
                  <option value="Pressure Ulcer">Pressure Ulcer</option>
                  <option value="Diabetic">Diabetic</option>
                  <option value="Traumatic">Traumatic</option>
                </select>
              </div>

              <div>
                <label htmlFor="admissionDate" className="block text-gray-700 mb-2">
                  Admission Date
                </label>
                <input
                  id="admissionDate"
                  type="date"
                  value={admissionDate}
                  onChange={(e) => setAdmissionDate(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              {submitError && (
                <div className="md:col-span-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {submitError}
                </div>
              )}

              <div className="md:col-span-2 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-6 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-300"
                >
                  {isSubmitting ? "Adding..." : "Add Patient"}
                </button>
              </div>
            </form>
          </div>
        )}

        {isLoading ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center text-gray-600">
            Loading patients...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {patients.map((patient) => (
              <div
                key={patient.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="bg-blue-100 p-3 rounded-lg">
                    <User className="w-6 h-6 text-blue-600" />
                  </div>
                </div>

                <h3 className="text-gray-900 mb-2">{patient.name}</h3>

                <div className="space-y-2 text-gray-600">
                  <p>Age: {patient.age} years</p>
                  <p>Wound: {patient.woundType}</p>
                  <p>Device ID: {patient.deviceId ?? "Not assigned"}</p>
                  <p>
                    Baseline:{" "}
                    {patient.baselineTemperatureC !== null
                      ? `${patient.baselineTemperatureC.toFixed(1)} °C`
                      : "Not set"}
                  </p>
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                    <Calendar className="w-4 h-4" />
                    <span>Admitted: {patient.admissionDate}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && patients.length === 0 && !showAddForm && (
          <div className="text-center py-16">
            <div className="bg-gray-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-gray-900 mb-2">No Patients Yet</h3>
            <p className="text-gray-600 mb-6">Add your first patient to start monitoring</p>
          </div>
        )}
      </div>
    </div>
  );
}
