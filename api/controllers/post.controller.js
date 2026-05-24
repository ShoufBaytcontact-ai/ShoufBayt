import prisma from "../lib/prisma.js";
import jwt from "jsonwebtoken";

export const getPosts = async (req, res) => {
  const query = req.query;

  try {
    const filters = {};

    if (query.city) {
      filters.city = query.city;
    }

    if (query.type) {
      filters.type = query.type;
    }

    if (query.property) {
      filters.property = query.property;
    }

    if (query.bedroom) {
      filters.bedroom = Number(query.bedroom);
    }

    filters.price = {
      gte: query.minPrice ? Number(query.minPrice) : 0,
      lte: query.maxPrice ? Number(query.maxPrice) : 1000000000,
    };

    const posts = await prisma.post.findMany({
      where: filters,
      include: {
        postDetail: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.status(200).json(posts);
  } catch (error) {
    console.log("GET POSTS ERROR:", error);
    res.status(500).json({ message: "Failed to get posts" });
  }
};

export const getPost = async (req, res) => {
  const id = req.params.id;

  try {
    const post = await prisma.post.findUnique({
      where: {
        id,
      },
      include: {
        postDetail: true,
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    let isSaved = false;

    const token = req.cookies?.token;

    if (token) {
      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET_KEY);

        const saved = await prisma.savedPost.findUnique({
          where: {
            userId_postId: {
              userId: payload.id,
              postId: id,
            },
          },
        });

        isSaved = saved ? true : false;
      } catch (error) {
        isSaved = false;
      }
    }

    res.status(200).json({
      ...post,
      isSaved,
    });
  } catch (error) {
    console.log("GET POST ERROR:", error);
    res.status(500).json({ message: "Failed to get post" });
  }
};

export const addPost = async (req, res) => {
  const tokenUserId = req.userId;

  try {
    if (!req.body.postData) {
      return res.status(400).json({ message: "postData is missing" });
    }

    if (!req.body.postDetail) {
      return res.status(400).json({ message: "postDetail is missing" });
    }

    const postData =
      typeof req.body.postData === "string"
        ? JSON.parse(req.body.postData)
        : req.body.postData;

    const postDetail =
      typeof req.body.postDetail === "string"
        ? JSON.parse(req.body.postDetail)
        : req.body.postDetail;

    if (!postData.title) {
      return res.status(400).json({ message: "Title is required" });
    }

    if (!postData.price) {
      return res.status(400).json({ message: "Price is required" });
    }

    if (!postData.address) {
      return res.status(400).json({ message: "Address is required" });
    }

    if (!postData.city) {
      return res.status(400).json({ message: "City is required" });
    }

    if (!postData.bedroom) {
      return res.status(400).json({ message: "Bedroom is required" });
    }

    if (!postData.bathroom) {
      return res.status(400).json({ message: "Bathroom is required" });
    }

    if (!postData.latitude || !postData.longitude) {
      return res.status(400).json({ message: "Location is required" });
    }

    if (!postData.type) {
      return res.status(400).json({ message: "Type is required" });
    }

    if (!postData.property) {
      return res.status(400).json({ message: "Property category is required" });
    }

    const uploadedImages = req.files
      ? req.files.map(
          (file) =>
            req.protocol + "://" + req.get("host") + "/uploads/" + file.filename
        )
      : [];

    if (uploadedImages.length === 0) {
      return res.status(400).json({ message: "At least one image is required" });
    }

    const newPost = await prisma.post.create({
      data: {
        title: postData.title,
        price: Number(postData.price),
        images: uploadedImages,
        address: postData.address,
        city: postData.city,
        bedroom: Number(postData.bedroom),
        bathroom: Number(postData.bathroom),
        latitude: String(postData.latitude),
        longitude: String(postData.longitude),
        type: postData.type,
        property: postData.property,
        userId: tokenUserId,

        postDetail: {
          create: {
            desc: postDetail.desc || "",
            size: postDetail.size ? Number(postDetail.size) : null,
          },
        },
      },
      include: {
        postDetail: true,
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    res.status(201).json(newPost);
  } catch (error) {
    console.log("ADD POST ERROR:", error);
    res.status(500).json({
      message: "Failed to add post",
      error: error.message,
    });
  }
};

export const updatePost = async (req, res) => {
  const tokenUserId = req.userId;
  const postId = req.params.id;

  try {
    const loggedUser = await prisma.user.findUnique({
      where: {
        id: tokenUserId,
      },
      select: {
        id: true,
        role: true,
      },
    });

    if (!loggedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const post = await prisma.post.findUnique({
      where: {
        id: postId,
      },
      include: {
        postDetail: true,
      },
    });

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const isOwner = post.userId === tokenUserId;
    const isAdmin = loggedUser.role?.toUpperCase() === "ADMIN";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        message: "You are not allowed to edit this post",
      });
    }

    const {
      title,
      price,
      address,
      city,
      bedroom,
      bathroom,
      latitude,
      longitude,
      type,
      property,
      desc,
      size,
      existingImages,
    } = req.body;

    const postData = {};

    if (title !== undefined) {
      postData.title = title;
    }

    if (price !== undefined) {
      postData.price = Number(price);
    }

    if (address !== undefined) {
      postData.address = address;
    }

    if (city !== undefined) {
      postData.city = city;
    }

    if (bedroom !== undefined) {
      postData.bedroom = Number(bedroom);
    }

    if (bathroom !== undefined) {
      postData.bathroom = Number(bathroom);
    }

    if (latitude !== undefined) {
      postData.latitude = String(latitude);
    }

    if (longitude !== undefined) {
      postData.longitude = String(longitude);
    }

    if (type !== undefined) {
      postData.type = type;
    }

    if (property !== undefined) {
      postData.property = property;
    }

    let keptImages = post.images || [];

    if (existingImages !== undefined) {
      try {
        keptImages = JSON.parse(existingImages);

        if (!Array.isArray(keptImages)) {
          keptImages = [];
        }
      } catch (error) {
        keptImages = [];
      }
    }

    const uploadedImages = req.files
      ? req.files.map(
          (file) =>
            req.protocol + "://" + req.get("host") + "/uploads/" + file.filename
        )
      : [];

    if (existingImages !== undefined || uploadedImages.length > 0) {
      postData.images = [...keptImages, ...uploadedImages];
    }

    const updatedPost = await prisma.post.update({
      where: {
        id: postId,
      },
      data: postData,
    });

    const postDetailData = {};

    if (desc !== undefined) {
      postDetailData.desc = desc;
    }

    if (size !== undefined) {
      postDetailData.size = size ? Number(size) : null;
    }

    let updatedPostDetail = post.postDetail;

    if (Object.keys(postDetailData).length > 0) {
      updatedPostDetail = await prisma.postDetail.upsert({
        where: {
          postId,
        },
        update: postDetailData,
        create: {
          desc: desc || "",
          size: size ? Number(size) : null,
          postId,
        },
      });
    }

    res.status(200).json({
      ...updatedPost,
      postDetail: updatedPostDetail,
    });
  } catch (error) {
    console.log("UPDATE POST ERROR:", error);
    res.status(500).json({
      message: "Failed to update post",
      error: error.message,
    });
  }
};

export const deletePost = async (req, res) => {
  const id = req.params.id;
  const tokenUserId = req.userId;

  try {
    const loggedUser = await prisma.user.findUnique({
      where: {
        id: tokenUserId,
      },
      select: {
        id: true,
        role: true,
      },
    });

    if (!loggedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const post = await prisma.post.findUnique({
      where: {
        id,
      },
    });

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const isOwner = post.userId === tokenUserId;
    const isAdmin = loggedUser.role?.toUpperCase() === "ADMIN";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: "Not authorized!" });
    }

    await prisma.savedPost.deleteMany({
      where: {
        postId: id,
      },
    });

    await prisma.postDetail.deleteMany({
      where: {
        postId: id,
      },
    });

    await prisma.post.delete({
      where: {
        id,
      },
    });

    res.status(200).json({ message: "Post has been deleted" });
  } catch (error) {
    console.log("DELETE POST ERROR:", error);
    res.status(500).json({ message: "Failed to delete post" });
  }
};

export const updatePostStatus = async (req, res) => {
  const postId = req.params.id;
  const tokenUserId = req.userId;
  const { status } = req.body;

  const allowedStatuses = ["available", "sold", "rented"];

  try {
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const loggedUser = await prisma.user.findUnique({
      where: {
        id: tokenUserId,
      },
      select: {
        id: true,
        role: true,
      },
    });

    if (!loggedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const post = await prisma.post.findUnique({
      where: {
        id: postId,
      },
    });

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const isOwner = post.userId === tokenUserId;
    const isAdmin = loggedUser.role?.toUpperCase() === "ADMIN";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        message: "You are not allowed to update this post status",
      });
    }

    if (post.type === "buy" && status === "rented") {
      return res.status(400).json({
        message: "A property for sale cannot be marked as rented",
      });
    }

    if (post.type === "rent" && status === "sold") {
      return res.status(400).json({
        message: "A property for rent cannot be marked as sold",
      });
    }

    const updatedPost = await prisma.post.update({
      where: {
        id: postId,
      },
      data: {
        status,
      },
      include: {
        postDetail: true,
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    res.status(200).json(updatedPost);
  } catch (error) {
    console.log("UPDATE POST STATUS ERROR:", error);
    res.status(500).json({
      message: "Failed to update post status",
      error: error.message,
    });
  }
};