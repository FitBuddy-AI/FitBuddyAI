export type AvatarCatalogItem = {
  id: string;
  name: string;
  image: string;
  price: number;
  type: 'avatar';
  description: string;
};

export const SHOP_AVATARS: AvatarCatalogItem[] = [
  { id: 'avatar1', name: 'Bot Buddy', image: 'https://api.dicebear.com/7.x/bottts/svg?seed=FitBuddyAI1', price: 100, type: 'avatar', description: 'A friendly robot avatar.' },
  { id: 'avatar2', name: 'Dragon Head', image: 'https://api.dicebear.com/7.x/bottts/svg?seed=DragonHead', price: 200, type: 'avatar', description: 'Unleash your inner dragon!' },
  { id: 'avatar3', name: 'Duolingo Owl', image: 'https://api.dicebear.com/7.x/bottts/svg?seed=Duolingo', price: 250, type: 'avatar', description: 'Inspired by the language learning legend.' },
  { id: 'avatar4', name: 'Neo Cat', image: 'https://api.dicebear.com/7.x/croodles/svg?seed=NeoCat', price: 120, type: 'avatar', description: 'A sleek cyber cat.' },
  { id: 'avatar5', name: 'Mountain Goat', image: 'https://api.dicebear.com/7.x/bottts/svg?seed=Goat', price: 140, type: 'avatar', description: 'Sturdy and sure-footed.' },
  { id: 'avatar6', name: 'Galaxy Fox', image: 'https://api.dicebear.com/7.x/bottts/svg?seed=GalaxyFox', price: 220, type: 'avatar', description: 'Out-of-this-world style.' },
  { id: 'avatar7', name: 'Pixel Pup', image: 'https://api.dicebear.com/7.x/bottts/svg?seed=PixelPup', price: 80, type: 'avatar', description: 'Cute pixel-styled puppy.' },
  { id: 'avatar8', name: 'Samurai', image: 'https://api.dicebear.com/7.x/bottts/svg?seed=Samurai', price: 300, type: 'avatar', description: 'Honor and style.' },
  { id: 'avatar9', name: 'Astronaut', image: 'https://api.dicebear.com/7.x/bottts/svg?seed=Astronaut', price: 260, type: 'avatar', description: 'Reach for the stars.' },
  { id: 'avatar10', name: 'Vintage Robot', image: 'https://api.dicebear.com/7.x/bottts/svg?seed=VintageBot', price: 110, type: 'avatar', description: 'Retro charm.' },
  { id: 'avatar11', name: 'Neon Ninja', image: 'https://api.dicebear.com/7.x/bottts/svg?seed=NeonNinja', price: 210, type: 'avatar', description: 'Stealthy and bright.' },
  { id: 'avatar12', name: 'Forest Sprite', image: 'https://api.dicebear.com/7.x/bottts/svg?seed=ForestSprite', price: 130, type: 'avatar', description: 'Whimsical woodland friend.' },
  { id: 'avatar13', name: 'Forest Sprite', image: '/images/ChatGPT_Image_Clan_Of_27_Fire.png', price: 130, type: 'avatar', description: 'Whimsical woodland friend.' }
];

export const SHOP_AVATAR_URLS = SHOP_AVATARS.map((avatar) => avatar.image);