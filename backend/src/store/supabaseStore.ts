import { createDefaultAlertSettings } from "../alerting/defaults";
import { SupabaseConfig } from "../config/supabase";
import { AlertRecord, DeviceAlertSettings } from "../types/alerting";
import { Reading, StoredReading } from "../types/reading";
import { ReadingQueryOptions, ReadingsStore } from "./readingsStore";

export class SupabaseStore implements ReadingsStore {
  constructor(private readonly config: SupabaseConfig) {}

  async add(reading: Reading): Promise<StoredReading> {
    const rows = await this.requestTable<StoredReading[]>(
      this.config.readingsTable,
      this.buildQuery({
        select: "id,device_id,temperature_c,timestamp,created_at",
      }),
      {
        method: "POST",
        headers: {
          Prefer: "return=representation",
        },
        body: JSON.stringify([reading]),
      },
    );

    const storedReading = rows[0];
    if (!storedReading) {
      throw new Error("Supabase did not return the inserted reading.");
    }

    return storedReading;
  }

  async latest(): Promise<StoredReading | null> {
    const rows = await this.requestTable<StoredReading[]>(
      this.config.readingsTable,
      this.buildQuery({
        select: "id,device_id,temperature_c,timestamp,created_at",
        order: "timestamp.desc",
        limit: 1,
      }),
      {
        method: "GET",
      },
    );

    return rows[0] ?? null;
  }

  async history(): Promise<StoredReading[]> {
    return this.requestTable<StoredReading[]>(
      this.config.readingsTable,
      this.buildQuery({
        select: "id,device_id,temperature_c,timestamp,created_at",
        order: "timestamp.asc",
      }),
      {
        method: "GET",
      },
    );
  }

  async historyForDevice(
    deviceId: string,
    options?: ReadingQueryOptions,
  ): Promise<StoredReading[]> {
    const searchParams = new URLSearchParams();
    searchParams.set("select", "id,device_id,temperature_c,timestamp,created_at");
    searchParams.set("device_id", `eq.${deviceId}`);
    searchParams.set("order", "timestamp.asc");

    if (
      options?.sinceTimestamp !== undefined &&
      options?.untilTimestamp !== undefined
    ) {
      searchParams.set(
        "and",
        `(timestamp.gte.${options.sinceTimestamp},timestamp.lte.${options.untilTimestamp})`,
      );
    } else if (options?.sinceTimestamp !== undefined) {
      searchParams.set("timestamp", `gte.${options.sinceTimestamp}`);
    } else if (options?.untilTimestamp !== undefined) {
      searchParams.set("timestamp", `lte.${options.untilTimestamp}`);
    }

    if (options?.limit !== undefined) {
      searchParams.set("limit", String(options.limit));
    }

    return this.requestTable<StoredReading[]>(
      this.config.readingsTable,
      this.searchParamsToQuery(searchParams),
      {
        method: "GET",
      },
    );
  }

  async getAlertSettings(deviceId: string): Promise<DeviceAlertSettings> {
    const rows = await this.requestTable<DeviceAlertSettings[]>(
      this.config.alertSettingsTable,
      this.buildQuery({
        select:
          "device_id,window_minutes,min_readings,warning_delta_c,risk_delta_c,warning_rate_c_per_hour,risk_rate_c_per_hour",
        device_id: `eq.${deviceId}`,
        limit: 1,
      }),
      {
        method: "GET",
      },
    );

    return rows[0] ?? createDefaultAlertSettings(deviceId);
  }

  async createAlert(alert: AlertRecord): Promise<void> {
    await this.requestTable(
      this.config.alertsTable,
      this.buildQuery({
        on_conflict: "reading_id",
      }),
      {
        method: "POST",
        headers: {
          Prefer: "resolution=ignore-duplicates,return=minimal",
        },
        body: JSON.stringify([alert]),
      },
    );
  }

  private async requestTable<T>(
    table: string,
    query: string,
    init: Omit<RequestInit, "headers"> & { headers?: Record<string, string> },
  ): Promise<T> {
    const response = await fetch(`${this.tableEndpoint(table)}${query}`, {
      ...init,
      headers: {
        apikey: this.config.serviceRoleKey,
        Authorization: `Bearer ${this.config.serviceRoleKey}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Supabase request failed (${response.status} ${response.statusText}): ${errorText}`,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const responseText = await response.text();
    if (!responseText) {
      return undefined as T;
    }

    return JSON.parse(responseText) as T;
  }

  private buildQuery(params: Record<string, string | number>): string {
    const searchParams = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
      searchParams.set(key, String(value));
    }

    return this.searchParamsToQuery(searchParams);
  }

  private searchParamsToQuery(searchParams: URLSearchParams): string {
    const query = searchParams.toString();
    return query ? `?${query}` : "";
  }

  private tableEndpoint(table: string): string {
    const baseUrl = this.config.url.replace(/\/+$/, "");
    return `${baseUrl}/rest/v1/${encodeURIComponent(table)}`;
  }
}
