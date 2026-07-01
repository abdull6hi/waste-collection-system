// Handles user registration, login, and current-user lookup.
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import * as UserModel from '../models/user.model.js';

const SALT_ROUNDS = 12;

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

export async function register(req, res) {
  const { name, email, password } = req.body;
  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
  // Role is always 'resident' for public registration — privilege escalation prevented here.
  // Officials are created by existing officials via POST /api/users/officials.
  // Collectors are created by officials via POST /api/collectors.
  // Duplicate email is caught by the DB unique constraint → 409 via error handler
  const user = await UserModel.create({ name, email, password_hash, role: 'resident' });
  const token = signToken(user);
  res.status(201).json({ token, user });
}

export async function login(req, res) {
  const { email, password } = req.body;
  const record = await UserModel.findByEmail(email);
  if (!record) {
    return res.status(401).json({ error: { message: 'Invalid email or password' } });
  }
  const match = await bcrypt.compare(password, record.password_hash);
  if (!match) {
    return res.status(401).json({ error: { message: 'Invalid email or password' } });
  }
  const user = UserModel.sanitizeUser(record);
  const token = signToken(user);
  res.status(200).json({ token, user });
}

export async function me(req, res) {
  const user = await UserModel.findById(req.user.id);
  if (!user) return res.status(404).json({ error: { message: 'User not found' } });
  res.status(200).json({ user });
}
