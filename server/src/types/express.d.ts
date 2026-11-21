import { Role } from '../models/User';
import { BusinessDoc } from '../models/Business';

declare global {
  namespace Express {
    interface Request {
      auth?: { userId: string; firmId: string; role: Role; name: string };
      business?: BusinessDoc;
    }
  }
}
export {};