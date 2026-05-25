export type ConflictTypeKey =
  | 'schema'
  | 'content_contradiction'
  | 'content_conflict'
  | 'content_duplicate'
  | 'content_update';

export type DatabaseType = 'vector database' | 'graph database';
export type SeverityType = 'low' | 'medium' | 'high';
export type ConflictStatusType = 'pending' | 'awaiting' | 'resolved';

export interface Conflict {
  conflict_id: string;
  tenant_id: string;
  conflict_type: ConflictTypeKey;
  where_happens: DatabaseType;
  severity: SeverityType;
  detected_at: string;
  status: ConflictStatusType;
  detailed_explanation: string;
  existing_snapshot: Record<string, any> | string;
  incoming_snapshot: Record<string, any> | string;
  resolution_instruction?: string;
  resolved_at?: string;
  resolved_by?: string;
  selected_resolution_method?: 'keep_existing' | 'keep_incoming' | 'merge_custom' | 'no_action';
  affected_location: string;
  batch_id: string;
}

export interface ConflictBatch {
  id: string;
  name: string;
  date: string;
  description: string;
}

export const CONFLICT_TYPE_LABELS: Record<ConflictTypeKey, { title: string; desc: string }> = {
  schema: {
    title: 'Schema Exception',
    desc: 'Same table name but extracted_schema is different than stored metadata schema.',
  },
  content_contradiction: {
    title: 'Content Contradiction',
    desc: 'Content that cannot be true at the same time (strictly requesting to keep one only).',
  },
  content_conflict: {
    title: 'Content Conflict',
    desc: 'Content that can be true at the same time (allow to be merged).',
  },
  content_duplicate: {
    title: 'Content Duplication',
    desc: 'Content that has same meaning (strictly merge or keep one only for quality of similarity search).',
  },
  content_update: {
    title: 'Content Update',
    desc: 'Existing data but out of date content (ask to keep one or no action taken).',
  },
};
