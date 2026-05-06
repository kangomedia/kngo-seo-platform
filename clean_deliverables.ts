import { prisma } from './src/lib/prisma';

async function main() {
  const allDeliverables = await prisma.deliverable.findMany({
    orderBy: { createdAt: 'asc' }
  });
  
  const seen = new Set();
  const toDelete = [];
  
  for (const d of allDeliverables) {
    const key = `${d.clientId}-${d.month}-${d.year}-${d.name}`;
    if (seen.has(key)) {
      toDelete.push(d.id);
    } else {
      seen.add(key);
    }
  }
  
  if (toDelete.length > 0) {
    console.log(`Found ${toDelete.length} duplicate deliverables. Deleting...`);
    await prisma.deliverable.deleteMany({
      where: { id: { in: toDelete } }
    });
    console.log('Duplicates deleted.');
  } else {
    console.log('No duplicates found.');
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
