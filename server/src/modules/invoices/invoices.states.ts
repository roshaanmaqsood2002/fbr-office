import { InvoiceStatus } from '../../models/Invoice';
import { AppError } from '../../utils/AppError';

export const TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ['awaiting_approval', 'ready_to_submit', 'cancelled'],
  awaiting_approval: ['ready_to_submit', 'draft', 'cancelled'], // approve / return for changes
  ready_to_submit: ['submitted', 'draft', 'cancelled'], // 'submitted' is used from Step 6; 'draft' = withdraw
  submitted: ['accepted', 'rejected', 'action_required'], // set by Step 6
  rejected: ['draft'], // revisit in Step 6 (FBR may require a new number)
  action_required: ['draft', 'ready_to_submit'],
  accepted: [],
  cancelled: [],
};

export const canTransition = (from: InvoiceStatus, to: InvoiceStatus) => TRANSITIONS[from].includes(to);

export function assertTransition(from: InvoiceStatus, to: InvoiceStatus) {
  if (!canTransition(from, to)) throw new AppError(409, `An invoice cannot move from ${from} to ${to}`);
}