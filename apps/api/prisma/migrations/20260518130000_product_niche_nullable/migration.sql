-- PR4: Make Product.nicheId nullable. Crawler không tự gán nữa — admin gán tay sau.
-- Change FK Cascade → SetNull (xoá niche không xoá products theo).

ALTER TABLE "Product" ALTER COLUMN "nicheId" DROP NOT NULL;

ALTER TABLE "Product" DROP CONSTRAINT "Product_nicheId_fkey";
ALTER TABLE "Product"
    ADD CONSTRAINT "Product_nicheId_fkey"
    FOREIGN KEY ("nicheId") REFERENCES "Niche"("id") ON DELETE SET NULL ON UPDATE CASCADE;
