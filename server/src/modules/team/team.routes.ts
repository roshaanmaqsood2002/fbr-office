import { Router } from 'express';
import { validate } from '../../middlewares/validate';
import { inviteSchema, updateMemberSchema } from './team.schema';
import * as c from './team.controller';

export const teamRouter = Router();

teamRouter.get('/members', c.members);
teamRouter.patch('/members/:id', validate(updateMemberSchema), c.updateMember);
teamRouter.get('/invitations', c.invitations);
teamRouter.post('/invitations', validate(inviteSchema), c.invite);
teamRouter.delete('/invitations/:id', c.revokeInvite);