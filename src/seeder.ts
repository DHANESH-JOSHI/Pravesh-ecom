import { User } from '@/modules/auth/auth.model';
export const seedDatabase = async () => {
    const adminEmail = 'admin@example.com';
    const existingAdmin = await User.findOne({ email: adminEmail });

    if (!existingAdmin) {
      await User.create({
        name: 'Admin User',
        email: adminEmail,
        phone: '9999999999',
        password: 'password123', // The pre-save hook in your model will hash this
        role: 'admin',
        status: 'active',
      });
      console.log('Default admin user created.');
    } else {
      console.log('Admin user already exists. Skipping.');
    }

    // --- Seed Regular User ---
    const userEmail = 'user@example.com';
    const existingUser = await User.findOne({ email: userEmail });

    if (!existingUser) {
      await User.create({
        name: 'Regular User',
        email: userEmail,
        phone: '8888888888',
        password: 'password123', // The pre-save hook will hash this
        role: 'user',
        status: 'active',
      });
      console.log('Default regular user created.');
    } else {
      console.log('Regular user already exists. Skipping.');
    }
};