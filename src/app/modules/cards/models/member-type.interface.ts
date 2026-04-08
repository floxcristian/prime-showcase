export interface FileWithPreview extends File {
  objectURL?: string;
}

export interface MemberType {
  name: string;
  code: string;
}

export interface PriceRangeSpec {
  value: string;
  checked: boolean;
}
