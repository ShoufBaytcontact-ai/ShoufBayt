import bcrypt from "bcrypt";
import prisma from "../lib/prisma.js";

export const getUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany();

    const safeUsers = users.map((user) => {
      const { password, ...userInfo } = user;
      return userInfo;
    });

    res.status(200).json(safeUsers);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to get users" });
  }
};

export const getUser = async (req, res) => {
  const id = req.params.id;

  try {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { password, ...userInfo } = user;

    res.status(200).json(userInfo);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to get user" });
  }
};

export const updateUser = async (req, res) => {
  const id = req.params.id;
  const tokenUserId = req.userId;

  if (id !== tokenUserId) {
    return res.status(403).json({ message: "Not authorized!" });
  }

  const { username, email, password } = req.body;

  try {
    const updatedData = {};

    if (username) {
      updatedData.username = username;
    }

    if (email) {
      updatedData.email = email;
    }

    if (password) {
      updatedData.password = await bcrypt.hash(password, 10);
    }

    if (req.file) {
      updatedData.avatar =
        req.protocol + "://" + req.get("host") + "/uploads/" + req.file.filename;
    }

    if (Object.keys(updatedData).length === 0) {
      return res.status(400).json({ message: "No data provided" });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updatedData,
    });

    const { password: userPassword, ...userInfo } = updatedUser;

    res.status(200).json(userInfo);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to update user" });
  }
};

export const deleteUser = async (req, res) => {
  const id = req.params.id;
  const tokenUserId = req.userId;

  if (id !== tokenUserId) {
    return res.status(403).json({ message: "Not authorized!" });
  }

  try {
    const userPosts = await prisma.post.findMany({
      where: { userId: id },
      select: { id: true },
    });

    const postIds = userPosts.map((post) => post.id);

    await prisma.savedPost.deleteMany({
      where: {
        OR: [
          { userId: id },
          {
            postId: {
              in: postIds,
            },
          },
        ],
      },
    });

    await prisma.postDetail.deleteMany({
      where: {
        postId: {
          in: postIds,
        },
      },
    });

    await prisma.post.deleteMany({
      where: { userId: id },
    });

    await prisma.user.delete({
      where: { id },
    });

    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to delete user" });
  }
};

export const savePost = async (req, res) => {
  const postId = req.params.id;
  const tokenUserId = req.userId;

  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const savedPost = await prisma.savedPost.findUnique({
      where: {
        userId_postId: {
          userId: tokenUserId,
          postId: postId,
        },
      },
    });

    if (savedPost) {
      await prisma.savedPost.delete({
        where: {
          id: savedPost.id,
        },
      });

      return res.status(200).json({ message: "Post removed from saved list" });
    }

    await prisma.savedPost.create({
      data: {
        userId: tokenUserId,
        postId: postId,
      },
    });

    res.status(200).json({ message: "Post saved successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to save post" });
  }
};

export const profilePosts = async (req, res) => {
  const tokenUserId = req.userId;

  try {
    const userPosts = await prisma.post.findMany({
      where: {
        userId: tokenUserId,
      },
      include: {
        postDetail: true,
      },
    });

    const saved = await prisma.savedPost.findMany({
      where: {
        userId: tokenUserId,
      },
      include: {
        post: {
          include: {
            postDetail: true,
          },
        },
      },
    });

    const savedPosts = saved.map((item) => item.post);

    res.status(200).json({
      userPosts,
      savedPosts,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to get profile posts" });
  }
};
export const getNotificationNumber = async (req, res) => {
  const tokenUserId = req.userId;

  try {
    const number = await prisma.chat.count({
      where: {
        userIDs: {
          has: tokenUserId,
        },
        NOT: {
          seenBy: {
            has: tokenUserId,
          },
        },
      },
    });

    res.status(200).json(number);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to get notification number" });
  }
};