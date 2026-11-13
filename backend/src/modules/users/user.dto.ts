import type { UserDocument } from './user.model';

export interface UserDto {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  avatarUrl: string | null;
  hasAvatar: boolean;
  storageUsedBytes: number;
  storageLimitBytes: number;
  createdAt: string;
}

/**
 * Avatar URL generation is added with the avatar upload flow. Until then the
 * DTO reports avatar presence honestly without exposing the Cloudinary ID.
 */
export function toUserDto(user: UserDocument): UserDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarUrl: null,
    hasAvatar: Boolean(user.avatarPublicId),
    storageUsedBytes: user.storageUsedBytes,
    storageLimitBytes: user.storageLimitBytes,
    createdAt: user.createdAt.toISOString(),
  };
}
