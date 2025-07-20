const { User } = require('../models');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

exports.register = async (req, res) => {
  try {
    const user = await User.create(req.body);
    res.status(201).json({ message: 'Usuario registrado', user });
  } catch (err) {
    res.status(400).json({ error: 'Error al registrar usuario' });
  }
};

exports.login = async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ where: { username } });
  if (!user || !(await bcrypt.compare(password, user.password)))
    return res.status(401).json({ error: 'Credenciales inválidas' });

  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  res.json({ token });
};

exports.editUser = async (req, res) => {
  const { username, email } = req.body;
  req.user.username = username || req.user.username;
  req.user.email = email || req.user.email;
  await req.user.save();
  res.json({ message: 'Usuario actualizado', user: req.user });
};

exports.deleteUser = async (req, res) => {
  await req.user.destroy();
  res.json({ message: 'Usuario eliminado' });
};
