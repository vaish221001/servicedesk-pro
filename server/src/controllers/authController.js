const User = require('../models/User');
const AppError = require('../utils/AppError');
const { generateToken } = require('../utils/jwt');

/**
 * @desc    Authenticate user & get token
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1. Validate required fields
    if (!email || !password) {
      return next(new AppError('Please provide email and password', 400));
    }

    // 2. Normalize email consistently
    const normalizedEmail = String(email).toLowerCase().trim();

    // 3. Retrieve user with password field explicitly selected
    const user = await User.findOne({ email: normalizedEmail }).select('+password');

    // 4. Verify user exists and password matches (generic message prevents account enumeration)
    if (!user || !(await user.comparePassword(password))) {
      return next(new AppError('Invalid email or password', 401));
    }

    // 5. Reject inactive user accounts
    if (!user.isActive) {
      return next(new AppError('User account is inactive', 401));
    }

    // 6. Update last login timestamp without re-validating other fields or touching password
    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

    // 7. Issue JWT with minimal claims (user ID in sub/id)
    const token = generateToken(user._id.toString());

    // 8. Return safe user profile (never expose password or password hash)
    const safeUserProfile = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      jobTitle: user.jobTitle,
      role: user.role,
      organizationId: user.organizationId,
      departmentId: user.departmentId,
      assignedDepartments: user.assignedDepartments,
      avatarUrl: user.avatarUrl,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    res.status(200).json({
      success: true,
      token,
      user: safeUserProfile,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get current authenticated user profile
 * @route   GET /api/auth/me
 * @access  Private (Authenticated)
 */
const getMe = async (req, res, next) => {
  try {
    // req.user is populated by the auth middleware with password excluded
    res.status(200).json({
      success: true,
      user: req.user,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  login,
  getMe,
};
