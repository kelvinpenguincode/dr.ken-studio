import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * Product catalog: categories group items in the dropdown.
 * Only the item names are selectable products.
 */
const PRODUCT_CATALOG: Array<{
  category: string;
  items: string[];
}> = [
  {
    category: "brān®",
    items: ["brān® - Chocolate Mint"],
  },
  {
    category: "uüth®",
    items: ["uüth® - Superberry"],
  },
  {
    category: "plôs® THERMO",
    items: ["plôs® THERMO - Mocha"],
  },
  {
    category: "Reserve® v2.0 Limited Edition",
    items: ["Reserve® v2.0 Limited Edition"],
  },
  {
    category: "AM Essentials® v2.0",
    items: ["AM Essentials® v2.0 - Caplets"],
  },
  {
    category: "PM Essentials® v2.0",
    items: ["PM Essentials® v2.0 - Caplets"],
  },
  {
    category: "Luminesce® v2.0",
    items: [
      "Luminesce® v2.0 - Cleanser",
      "Luminesce® v2.0 - Daily Moisturizer",
      "Luminesce® v2.0 - Body Renewal",
      "Luminesce® v2.0 - Night Repair",
      "Luminesce® v2.0 - Serum",
    ],
  },
  {
    category: "Finiti® v2.0",
    items: ["Finiti® v2.0"],
  },
  {
    category: "RevitaBLŪ® v2.0",
    items: ["RevitaBLŪ® v2.0"],
  },
  {
    category: "M1ND™ v2.0",
    items: ["M1ND™ v2.0"],
  },
  {
    category: "L1FE NMN® v2.0",
    items: ["L1FE NMN® v2.0"],
  },
  {
    category: "m·mūn 365®",
    items: ["m·mūn 365®"],
  },
  {
    category: "(M)mūn™ Powder",
    items: ["(M)mūn™ Powder Supplement"],
  },
  {
    category: "tuün® RESONATE",
    items: [
      "tuün® RESONATE - Black",
      "tuün® RESONATE - Rose Gold",
      "tuün® RESONATE - Swarovski Diamonds",
    ],
  },
];

async function main() {
  console.log("Seeding products...");

  // Deactivate any old sample products that are no longer in the catalog
  const catalogNames = PRODUCT_CATALOG.flatMap((group) => group.items);
  await prisma.product.updateMany({
    where: { name: { notIn: catalogNames } },
    data: { active: false },
  });

  let sortOrder = 0;
  for (const group of PRODUCT_CATALOG) {
    for (const name of group.items) {
      await prisma.product.upsert({
        where: { name },
        update: {
          category: group.category,
          description: group.category,
          active: true,
          sortOrder,
        },
        create: {
          name,
          category: group.category,
          description: group.category,
          active: true,
          sortOrder,
        },
      });
      sortOrder += 1;
    }
  }

  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@fengjie.local";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "admin123";
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  console.log("Seeding admin user...");
  await prisma.admin.upsert({
    where: { email: adminEmail },
    update: { passwordHash, name: "Site Admin" },
    create: {
      email: adminEmail,
      passwordHash,
      name: "Site Admin",
    },
  });

  console.log(`Seeded ${catalogNames.length} products across ${PRODUCT_CATALOG.length} categories.`);
  console.log(`Admin login: ${adminEmail} / ${adminPassword}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
