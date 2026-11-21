import { Router } from 'express';
import * as c from './auth.controller';
import { validate } from '../../middlewares/validate';
import { acceptInviteSchema, loginSchema, signupSchema } from './auth.schemas';
import { authenticate } from '../../middlewares/auth';

export const authRouter = Router();

authRouter.post('/signup', validate(signupSchema), c.signup);
authRouter.post('/login', validate(loginSchema), c.login);
authRouter.post('/refresh', c.refresh);
authRouter.post('/logout', c.logout);
authRouter.get('/me', authenticate, c.me);
authRouter.get('/invitations/:token', c.invitationPreview);
authRouter.post('/accept-invite', validate(acceptInviteSchema), c.acceptInvite);