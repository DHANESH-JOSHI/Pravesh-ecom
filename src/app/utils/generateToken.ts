import jwt from 'jsonwebtoken';
import { IUser } from '@/modules/user/user.interface';
export const generateToken = (user: IUser) => {
  const payload = {
    userId: user._id,
    name: user.name,
    phone: user.phone,
    role: user.role,
  };
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '7d' });
};
