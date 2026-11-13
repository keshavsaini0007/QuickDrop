import { randomUUID } from 'node:crypto';
import { cloudinaryConfigured } from '../src/config/cloudinary';
import {
  buildPrivateDownloadUrl,
  createUploadSignature,
  deleteCloudinaryAsset,
  verifyUploadedAsset,
} from '../src/utils/cloudinaryAssets';

/**
 * Opt-in integration test. It is skipped during the normal suite and only runs
 * through `npm run test:cloudinary` with real credentials configured. It never
 * prints the API secret or signed URLs.
 */
const integration = cloudinaryConfigured ? describe : describe.skip;

integration('Cloudinary authenticated asset lifecycle', () => {
  const publicId = `quickdrop/integration/${randomUUID()}`;
  let uploaded = false;

  afterAll(async () => {
    if (uploaded) {
      await deleteCloudinaryAsset(publicId, 'raw');
    }
  });

  it('signs, uploads, verifies, creates a private URL, and deletes a file', async () => {
    const signature = createUploadSignature({
      publicId,
      resourceType: 'raw',
      includeEagerThumbnail: false,
    });

    const form = new FormData();
    for (const [key, value] of Object.entries(signature.params)) {
      form.append(key, String(value));
    }
    form.append(
      'file',
      new Blob([Buffer.from('QuickDrop Cloudinary integration test.')], {
        type: 'text/plain',
      }),
      'quickdrop-integration.txt',
    );

    const response = await fetch(signature.uploadUrl, { method: 'POST', body: form });
    const body = (await response.json()) as { error?: { message?: string } };
    expect(response.ok).toBe(true);
    if (!response.ok) {
      throw new Error(body.error?.message ?? 'Cloudinary upload failed.');
    }
    uploaded = true;

    const verified = await verifyUploadedAsset(publicId, 'raw');
    expect(verified.publicId).toBe(publicId);
    expect(verified.bytes).toBeGreaterThan(0);

    const signed = buildPrivateDownloadUrl(
      {
        publicId,
        resourceType: 'raw',
        format: verified.format ?? 'txt',
        version: verified.version,
      },
      { expiresInSeconds: 60 },
    );
    expect(signed.url).toContain('api.cloudinary.com');
    expect(signed.expiresAt.getTime()).toBeGreaterThan(Date.now());

    await deleteCloudinaryAsset(publicId, 'raw');
    uploaded = false;
  });
});
