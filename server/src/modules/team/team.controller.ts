import { asyncHandler } from '../../utils/asyncHandler';
import { audit } from '../../utils/audit';
import * as service from './team.service';

export const members = asyncHandler(async (req, res) => {
  res.json({ members: await service.listMembers(req.auth!.firmId) });
});

export const updateMember = asyncHandler(async (req, res) => {
  const member = await service.updateMember(req.auth!, String(req.params.id), req.body);
  await audit(req.auth!, {
    action: req.body.isActive === false ? 'member.deactivated' : req.body.isActive ? 'member.reactivated' : 'member.role_changed',
    entityType: 'user',
    entityId: String(req.params.id),
    summary: `Updated member ${member.email}`,
    meta: req.body,
  });
  res.json({ member });
});

export const invitations = asyncHandler(async (req, res) => {
  res.json({ invitations: await service.listInvitations(req.auth!.firmId) });
});

export const invite = asyncHandler(async (req, res) => {
  const result = await service.createInvitation(req.auth!, req.body);
  await audit(req.auth!, {
    action: 'member.invited',
    entityType: 'invitation',
    entityId: result.invitation.id,
    summary: `Invited ${result.invitation.email} as ${result.invitation.role}`,
  });
  res.status(201).json(result);
});

export const revokeInvite = asyncHandler(async (req, res) => {
  await service.revokeInvitation(req.auth!.firmId, String(req.params.id));
  res.json({ message: 'Invitation revoked' });
});