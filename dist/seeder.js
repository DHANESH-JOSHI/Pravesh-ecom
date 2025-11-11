"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedDefaultAdmin = void 0;
const logger_1 = require("./app/config/logger");
const user_model_1 = require("./app/modules/user/user.model");
const seedDefaultAdmin = async () => {
    const adminEmail = 'admin@test.com';
    const existingAdmin = await user_model_1.User.findOne({ email: adminEmail });
    if (!existingAdmin) {
        await user_model_1.User.create({
            name: 'test admin',
            email: adminEmail,
            phone: '7654328765',
            password: "admin_password",
            role: 'admin',
            status: 'active',
        });
        logger_1.logger.info('Test admin user created.');
    }
};
exports.seedDefaultAdmin = seedDefaultAdmin;
//# sourceMappingURL=seeder.js.map