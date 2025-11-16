// import { logger } from '@/config/logger';
// import { User } from '@/modules/user/user.model';

// export const seedDefaultAdmin = async () => {
//   const adminEmail = 'admin@test.com';
//   const existingAdmin = await User.findOne({ email: adminEmail });
//   if (!existingAdmin) {
//     await User.create({
//       name: 'test admin',
//       email: adminEmail,
//       phone: '7654328765',
//       password: "admin_password",
//       role: 'admin',
//       status: 'active',
//     });
//     logger.info('Test admin user created.');
//   }
// };