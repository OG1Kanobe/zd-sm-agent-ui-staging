export const isAdmin = (userId: string | undefined): boolean => {
  if (!userId) return false;
  
  const adminIds = process.env.NEXT_PUBLIC_ADMIN_USER_IDS?.split(',').map(id => id.trim()) || [];
  return adminIds.includes(userId);
};