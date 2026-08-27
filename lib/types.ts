export type BookingStatus =
  | "pending_step2"
  | "confirmed"
  | "attended"
  | "no_show"
  | "cancelled";

export interface Host {
  id: string;
  name: string;
  email: string | null;
  calendar_id: string;
  timezone: string;
}

export interface HostAvailability {
  id: string;
  host_id: string;
  day_of_week: number; // 0=Sunday..6=Saturday
  start_time: string; // "HH:MM:SS"
  end_time: string;
}

export interface EventType {
  id: string;
  slug: string;
  name: string;
  headline: string | null;
  duration_min: number;
  host_id: string;
  buffer_min: number;
  active: boolean;
}

export interface Lead {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  activecampaign_contact_id: string | null;
}

export interface Booking {
  id: string;
  lead_id: string;
  event_type_id: string;
  status: BookingStatus;
  source_url: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  utm_medium: string | null;
  scheduled_at: string | null;
  google_event_id: string | null;
  created_at: string;
  step2_completed_at: string | null;
  outcome_marked_at: string | null;
  abandoned_tagged_at: string | null;
}

export interface TrackingParams {
  source_url: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  utm_medium: string | null;
}
