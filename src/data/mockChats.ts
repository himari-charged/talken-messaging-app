import type { Chat, Message, User } from "@/types/chat";

export const currentUser: User = {
  id: "me",
  name: "You",
  username: "you",
  wallet: "0x742d...8f2a",
  isOnline: true,
};

export const mockUsers: User[] = [
  {
    id: "1",
    name: "Himari",
    username: "himari",
    wallet: "0x8f3a...1b2c",
    isOnline: true,
  },
  {
    id: "2",
    name: "Alex",
    username: "alex_dev",
    wallet: "0x2b4c...9d3e",
    isOnline: false,
    lastSeen: new Date(Date.now() - 3600000),
  },
  {
    id: "3",
    name: "Sakura",
    username: "sakura",
    wallet: "0x5e6f...7a8b",
    isOnline: true,
  },
];

export const mockChats: Chat[] = [
  {
    id: "c1",
    participant: mockUsers[0],
    lastMessage: {
      content: "Sure, let's sync tomorrow!",
      timestamp: new Date(Date.now() - 120000),
      senderId: "1",
    },
    unreadCount: 0,
    isOnline: true,
  },
  {
    id: "c2",
    participant: mockUsers[1],
    lastMessage: {
      content: "The build is ready for review",
      timestamp: new Date(Date.now() - 3600000),
      senderId: "me",
    },
    unreadCount: 2,
    isOnline: false,
    lastSeen: new Date(Date.now() - 3600000),
  },
  {
    id: "c3",
    participant: mockUsers[2],
    lastMessage: {
      content: "Thanks for the tip! 🙏",
      timestamp: new Date(Date.now() - 86400000),
      senderId: "3",
    },
    unreadCount: 0,
    isOnline: true,
  },
];

const baseTime = Date.now();

export const mockMessages: Record<string, Message[]> = {
  c1: [
    {
      id: "m1",
      chatId: "c1",
      senderId: "1",
      content: "Hey! Are we still on for the call?",
      timestamp: new Date(baseTime - 600000),
      status: "read",
      isOutgoing: false,
    },
    {
      id: "m2",
      chatId: "c1",
      senderId: "me",
      content: "Yes! 3pm works for me.",
      timestamp: new Date(baseTime - 540000),
      status: "read",
      isOutgoing: true,
    },
    {
      id: "m3",
      chatId: "c1",
      senderId: "1",
      content: "Perfect. I'll send the agenda before then.",
      timestamp: new Date(baseTime - 480000),
      status: "read",
      isOutgoing: false,
    },
    {
      id: "m4",
      chatId: "c1",
      senderId: "me",
      content: "Sounds good 👍",
      timestamp: new Date(baseTime - 450000),
      status: "read",
      isOutgoing: true,
    },
    {
      id: "m5",
      chatId: "c1",
      senderId: "1",
      content: "Sure, let's sync tomorrow!",
      timestamp: new Date(baseTime - 120000),
      status: "delivered",
      isOutgoing: false,
      reactions: [{ emoji: "👍", userIds: ["me"] }],
    },
  ],
  c2: [
    {
      id: "m6",
      chatId: "c2",
      senderId: "2",
      content: "Pushed the latest changes to staging.",
      timestamp: new Date(baseTime - 7200000),
      status: "read",
      isOutgoing: false,
    },
    {
      id: "m7",
      chatId: "c2",
      senderId: "me",
      content: "The build is ready for review",
      timestamp: new Date(baseTime - 3600000),
      status: "delivered",
      isOutgoing: true,
    },
  ],
  c3: [
    {
      id: "m8",
      chatId: "c3",
      senderId: "3",
      content: "Thanks for the tip! 🙏",
      timestamp: new Date(baseTime - 86400000),
      status: "read",
      isOutgoing: false,
    },
  ],
};
