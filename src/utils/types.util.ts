export type Order_item = {
    product_type_id: number,
    product_type_name: string,
    product_id?: number,
    price: number,
    amount: number
}

export type GeneratedImg = {
  id: any;
  image_url: any;
  watermarked_url: string;
  seed: number;
  metadata: string;
};