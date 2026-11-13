import { FileBrowser } from '@/components/file-browser';

export default function FilesScreen() {
  return (
    <FileBrowser
      folderId={null}
      title="Files"
      subtitle="Everything in your private vault"
    />
  );
}
