import { logger } from '@/config/logger';
import { User } from '@/modules/user/user.model';

export const seedDatabase = async () => {
  const adminEmail = 'admin@example.com';
  const existingAdmin = await User.findOne({ email: adminEmail });

  if (!existingAdmin) {
    await User.create({
      name: 'admin',
      email: adminEmail,
      phone: '9999999999',
      password: "your_default_admin_password",
      role: 'admin',
      status: 'active',
    });
    logger.info('Test admin user created.');
  } else {
    logger.info('Test admin already exists. Skipping.');
  }

  const userEmail = 'user@example.com';
  const existingUser = await User.findOne({ email: userEmail });

  if (!existingUser) {
    await User.create({
      name: 'test_user',
      email: userEmail,
      phone: '8888888888',
      password: "your_default_user_password",
      role: 'user',
      status: 'active',
    });
    logger.info('Test user created.');
  } else {
    logger.info('Test user already exists. Skipping.');
  }
};