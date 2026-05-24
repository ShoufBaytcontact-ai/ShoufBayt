import jwt from "jsonwebtoken";

export const shouldBeLoggedIn = (req, res) => {
    console.log(req.userId);
    return res.status(200).json({
      message: "You are logged in and can access this route!",
    });
};

export const shouldBeAdmin = (req, res) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ message: "You are not logged in!" });
  }

  jwt.verify(token, process.env.JWT_SECRET_KEY, (err, payload) => {
    if (err) {
      return res.status(403).json({ message: "Token is not valid!" });
    }

    if (!payload.isAdmin) {
      return res.status(403).json({ message: "You are not an admin!" });
    }

    return res.status(200).json({
      message: "You are logged in and you are admin!",
    });
  });
};