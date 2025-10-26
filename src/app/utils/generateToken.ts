import jwt from 'jsonwebtoken';
import { IUser } from '@/modules/user/user.interface';
import config from '@/config';
export type Payload = {
  userId: string;
  name: string;
  phone: string;
  role: string;
};

const generateToken = (payload: Payload, expiresIn: string) => {
  return jwt.sign(payload, config.JWT_SECRET, { expiresIn: expiresIn as any });
};

export const generateTokens = (user: IUser) => {
  const payload = {
    userId: user._id,
    name: user.name,
    phone: user.phone,
    role: user.role
  } as Payload;
  const accessToken = generateToken(payload, '15m');
  const refreshToken = generateToken(payload, '7d');
  return { accessToken, refreshToken };
};

export const verifyToken = (token: string) => {
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    return decoded as Payload;
  } catch (error) {
    return false;
  }
};
