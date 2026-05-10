import { useState, useEffect } from "react";
import { MapPin, Plus, QrCode, Trash2, Shield, Clock, CheckCircle } from "lucide-react";
import { saveCheckpoint, subscribeCheckpoints } from "@/lib/firestore";
import { getCurrentPosition } from "@/lib/gps";
import { db } from "@/firebase";
import type { Checkpoint } from "@/types";

function generateQrCode(name: string): string {
  return `ARC_GUARD_CP_${name.toUpperCase().replace(/\s+/g, "_")}_${Date.now()}`;
}

export default function CheckpointManager() {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    location: "",
    lat: "",
    lng: "",
    radiusMeters: "50",
    schedule: "every-2h",
  });

  useEffect(() => {
    if (!db) return;
    const unsub = subscribeCheckpoints(setCheckpoints);
    return unsub;
  }, []);

  const captureGps = async () => {
    setGpsLoading(true);
    try {
      const coords = await getCurrentPosition();
      setForm((f) => ({ ...f, lat: coords.lat.toFixed(7), lng: coords.lng.toFixed(7) }));
    } catch {
      alert("Could not get GPS location.");
    } finally {
      setGpsLoading(false);
    }
  };

  const scheduleToMinutes = (s: string): number[] => {
    const now = new Date();
    const base = now.getHours() * 60 + now.getMinutes();
    switch (s) {
      case "every-1h": return Array.from({ length: 24 }, (_, i) => (base + i * 60) % 1440);
      case "every-2h": return Array.from({ length: 12 }, (_, i) => (base + i * 120) % 1440);
      case "every-4h": return Array.from({ length: 6 }, (_, i) => (base + i * 240) % 1440);
      case "every-8h": return Array.from({ length: 3 }, (_, i) => (base + i * 480) % 1440);
      default: return [];
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.lat || !form.lng) return;
    setSaving(true);
    try {
      await saveCheckpoint({
        name: form.name,
        location: form.location,
        qrCode: generateQrCode(form.name),
        lat: parseFloat(form.lat),
        lng: parseFloat(form.lng),
        radiusMeters: parseInt(form.radiusMeters),
        scheduledMinutes: scheduleToMinutes(form.schedule),
        active: true,
      });
      setForm({ name: "", location: "", lat: "", lng: "", radiusMeters: "50", schedule: "every-2h" });
      setShowForm(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert("Failed to save checkpoint: " + err);
    } finally {
      setSaving(false);
    }
  };

  const scheduleLabel = (s: string) => {
    const map: Record<string, string> = {
      "every-1h": "Every 1h", "every-2h": "Every 2h",
      "every-4h": "Every 4h", "every-8h": "Every 8h",
    };
    return map[s] ?? s;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Checkpoints</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{checkpoints.length} active checkpoints</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 text-xs text-primary-foreground bg-primary rounded-lg px-3 py-1.5 hover:opacity-90 transition-opacity font-medium"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Checkpoint
        </button>
      </div>

      {saved && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-2.5 flex items-center gap-2 text-sm text-green-400 animate-fade-in-up">
          <CheckCircle className="w-4 h-4" />
          Checkpoint saved successfully!
        </div>
      )}

      {/* Add Form */}
      {showForm && (
        <div className="rounded-xl border border-primary/30 bg-card p-4 animate-fade-in-up">
          <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" />
            New Checkpoint
          </h4>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <label className="text-xs text-muted-foreground uppercase tracking-wider">Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Main Gate"
                  required
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <div className="col-span-2 space-y-1">
                <label className="text-xs text-muted-foreground uppercase tracking-wider">Location Description</label>
                <input
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder="e.g. North entrance, Building A"
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground uppercase tracking-wider">Latitude *</label>
                <input
                  value={form.lat}
                  onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))}
                  placeholder="35.6892"
                  required
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground uppercase tracking-wider">Longitude *</label>
                <input
                  value={form.lng}
                  onChange={(e) => setForm((f) => ({ ...f, lng: e.target.value }))}
                  placeholder="51.3890"
                  required
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={captureGps}
              disabled={gpsLoading}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:bg-accent transition-colors"
            >
              <MapPin className="w-3.5 h-3.5" />
              {gpsLoading ? "Getting GPS..." : "Use My Current GPS Location"}
            </button>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground uppercase tracking-wider">Radius (m)</label>
                <select
                  value={form.radiusMeters}
                  onChange={(e) => setForm((f) => ({ ...f, radiusMeters: e.target.value }))}
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                >
                  {["10","25","50","100","200"].map((v) => <option key={v} value={v}>{v}m</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground uppercase tracking-wider">Schedule</label>
                <select
                  value={form.schedule}
                  onChange={(e) => setForm((f) => ({ ...f, schedule: e.target.value }))}
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                >
                  {["every-1h","every-2h","every-4h","every-8h"].map((v) => (
                    <option key={v} value={v}>{scheduleLabel(v)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !db}
                className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Checkpoint"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Checkpoint List */}
      {checkpoints.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-4 py-10 text-center">
          <Shield className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No checkpoints yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Add checkpoints for guards to scan during patrol.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {checkpoints.map((cp) => (
            <div
              key={cp.id}
              className="rounded-xl border border-border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{cp.name}</p>
                    {cp.location && <p className="text-xs text-muted-foreground truncate">{cp.location}</p>}
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        {cp.lat.toFixed(4)}, {cp.lng.toFixed(4)}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Shield className="w-3 h-3" />
                        {cp.radiusMeters}m radius
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {cp.scheduledMinutes.length} visits/day
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              {/* QR code string */}
              <div className="mt-3 p-2 rounded-lg bg-muted border border-border flex items-center gap-2">
                <QrCode className="w-3.5 h-3.5 text-primary shrink-0" />
                <p className="text-xs text-muted-foreground font-mono truncate">{cp.qrCode}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {!db && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-xs text-yellow-400">
          Firebase not configured — checkpoints cannot be saved to the cloud.
        </div>
      )}
    </div>
  );
}
