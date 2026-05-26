// Matches server ConflictType enum values exactly
export type ConflictType =
  | 'Table Schema'
  | 'Content Contradiction'
  | 'Content Conflict'
  | 'Content Duplicate'
  | 'Content Update';

// Matches server ConflictSeverity enum values exactly
export type SeverityType = 'High' | 'Medium' | 'Low';

export type ConflictStatusType = 'pending' | 'awaiting' | 'resolved';

// Matches server ConflictResolution enum values exactly
export type ResolutionMethod = 'Keep Existing' | 'Keep Incoming' | 'Merge' | 'No Action';

// Summary stored per row in the list — conflict_id is kept for reference only, not displayed
export interface ConflictSummary {
  conflict_id: string;
  conflict_type: ConflictType;
  severity: SeverityType;
  detected_at: string;
}

// Pending bucket wraps summaries inside batches
export interface ConflictBatchGroup {
  batch_id: string;
  batch_name: string;
  extracted_date: string;
  number_pending_conflict: number;
  conflicts: ConflictSummary[];
}

// Shape of GET /api/knowledge/conflicts
export interface ConflictsResponse {
  pending: ConflictBatchGroup[];
  awaiting: ConflictSummary[];
  resolved: ConflictSummary[];
}

// Full record loaded on row click via GET /api/knowledge/conflicts/{conflict_id}
export interface ConflictDetail {
  conflict_id: string;
  conflict_type: ConflictType;
  where_happens: string;
  severity: SeverityType;
  detected_at: string;
  status: ConflictStatusType;
  detailed_explanation: string;
  existing_snapshot: Record<string, unknown>;
  incoming_snapshot: Record<string, unknown>;
  affected_location: string;
  batch_id: string;
  resolution_instruction?: string;
  selected_resolution_method?: ResolutionMethod;
  resolved_at?: string;
  resolved_by?: string;
}

export const CONFLICT_TYPE_LABELS: Record<ConflictType, { title: string; desc: string }> = {
  'Table Schema': {
    title: 'Schema Exception',
    desc: 'Same table name but extracted schema is different than stored metadata schema.',
  },
  'Content Contradiction': {
    title: 'Content Contradiction',
    desc: 'Content that cannot be true at the same time (strictly requesting to keep one only).',
  },
  'Content Conflict': {
    title: 'Content Conflict',
    desc: 'Content that can be true at the same time (allow to be merged).',
  },
  'Content Duplicate': {
    title: 'Content Duplication',
    desc: 'Content that has same meaning (strictly merge or keep one only for quality of similarity search).',
  },
  'Content Update': {
    title: 'Content Update',
    desc: 'Existing data but out of date content (ask to keep one or no action taken).',
  },
};
