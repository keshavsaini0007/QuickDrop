import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

export interface Folder {
  owner: Types.ObjectId;
  name: string;
  nameKey: string;
  parent: Types.ObjectId | null;
  parentKey: string;
  deletedAt?: Date;
  trashBatchId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type FolderDocument = HydratedDocument<Folder>;

const folderSchema = new Schema<Folder>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
    nameKey: { type: String, required: true, maxlength: 120 },
    parent: { type: Schema.Types.ObjectId, ref: 'Folder', default: null },
    parentKey: { type: String, required: true, default: 'root', maxlength: 64 },
    deletedAt: { type: Date },
    trashBatchId: { type: String, index: true },
  },
  { timestamps: true },
);

folderSchema.index({ owner: 1, parentKey: 1, nameKey: 1 }, {
  unique: true,
  partialFilterExpression: { deletedAt: null },
});
folderSchema.index({ owner: 1, parentKey: 1, deletedAt: 1 });
folderSchema.index({ owner: 1, deletedAt: 1, createdAt: -1 });

export const FolderModel = model<Folder>('Folder', folderSchema);
export default FolderModel;
