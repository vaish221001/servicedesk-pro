/**
 * ServiceDesk Pro — Initial System Administrator Bootstrap Script
 *
 * Seeds the initial Organization, Primary IT Department, Default Categories,
 * and an authoritative SYSTEM_ADMIN account for initial setup and deployment.
 *
 * Usage:
 *   node scripts/bootstrapAdmin.js [email] [password] [firstName] [lastName]
 *
 * Or via environment variables:
 *   BOOTSTRAP_ADMIN_EMAIL=admin@example.com BOOTSTRAP_ADMIN_PASSWORD=SecurePassword123! node scripts/bootstrapAdmin.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const dns = require('dns');

try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch {
  // Use system defaults
}

const Organization = require('../src/models/Organization');
const Department = require('../src/models/Department');
const Category = require('../src/models/Category');
const User = require('../src/models/User');

const bootstrap = async () => {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/servicedesk_pro';
  console.log('[Bootstrap] Connecting to database...');

  await mongoose.connect(mongoURI, {
    serverSelectionTimeoutMS: 5000,
  });

  console.log('[Bootstrap] Database connected.');

  // CLI Arguments or Environment Defaults
  const email = (process.argv[2] || process.env.BOOTSTRAP_ADMIN_EMAIL || 'admin@servicedesk.local').toLowerCase().trim();
  const password = process.argv[3] || process.env.BOOTSTRAP_ADMIN_PASSWORD || 'Admin@123456';
  const firstName = process.argv[4] || 'System';
  const lastName = process.argv[5] || 'Administrator';

  // 1. Find or create Organization
  let org = await Organization.findOne({ slug: 'acme-corp' });
  if (!org) {
    org = await Organization.create({
      name: 'Acme Corporation',
      slug: 'acme-corp',
      domain: 'acme.com',
      contactEmail: 'it-support@acme.com',
    });
    console.log(`[Bootstrap] Created Organization: ${org.name} (${org._id})`);
  } else {
    console.log(`[Bootstrap] Existing Organization found: ${org.name} (${org._id})`);
  }

  // 2. Find or create IT Department
  let dept = await Department.findOne({ organizationId: org._id, code: 'IT' });
  if (!dept) {
    dept = await Department.create({
      organizationId: org._id,
      name: 'Information Technology',
      code: 'IT',
      description: 'Central IT Support & Infrastructure Department',
      isActive: true,
    });
    console.log(`[Bootstrap] Created Department: ${dept.name} (${dept._id})`);
  } else {
    console.log(`[Bootstrap] Existing Department found: ${dept.name} (${dept._id})`);
  }

  // 3. Find or create Default Service Categories
  const defaultCategories = [
    { name: 'Hardware & Workstations', defaultPriority: 'HIGH' },
    { name: 'Network & Connectivity', defaultPriority: 'HIGH' },
    { name: 'Software Applications', defaultPriority: 'MEDIUM' },
    { name: 'Identity & Access Management', defaultPriority: 'MEDIUM' },
  ];

  for (const catData of defaultCategories) {
    let cat = await Category.findOne({ organizationId: org._id, name: catData.name });
    if (!cat) {
      cat = await Category.create({
        organizationId: org._id,
        departmentId: dept._id,
        name: catData.name,
        defaultPriority: catData.defaultPriority,
        isActive: true,
      });
      console.log(`[Bootstrap] Created Category: ${cat.name}`);
    }
  }

  // 4. Find or create SYSTEM_ADMIN user
  let admin = await User.findOne({ email });
  if (admin) {
    console.log(`[Bootstrap] User with email '${email}' already exists (Role: ${admin.role}).`);
    console.log('[Bootstrap] No changes made to existing credentials.');
  } else {
    admin = await User.create({
      organizationId: org._id,
      departmentId: dept._id,
      firstName,
      lastName,
      email,
      password,
      role: 'SYSTEM_ADMIN',
      jobTitle: 'Lead Systems Administrator',
      isActive: true,
    });
    console.log(`[Bootstrap] Successfully created initial SYSTEM_ADMIN user: ${admin.email}`);
  }

  console.log('\n======================================================');
  console.log(' ServiceDesk Pro — Bootstrap Complete');
  console.log(' Organization ID :', org._id.toString());
  console.log(' Department ID   :', dept._id.toString());
  console.log(' Admin Email     :', admin.email);
  console.log(' Role            :', admin.role);
  console.log('======================================================\n');

  await mongoose.disconnect();
  process.exit(0);
};

bootstrap().catch((err) => {
  console.error('[Bootstrap Error]', err);
  process.exit(1);
});
