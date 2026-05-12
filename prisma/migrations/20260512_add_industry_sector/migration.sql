-- Add industrySector column (Tier 1 of the two-tier industry taxonomy)
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "industrySector" TEXT;

-- Backfill existing clients: map legacy industryVertical values to their sector.
-- Values not matched here retain NULL industrySector and can be reviewed manually.

-- Home Services & Trades
UPDATE "Client" SET "industrySector" = 'Home Services & Trades'
WHERE "industryVertical" IN (
  'Plumbing', 'HVAC', 'Electrical', 'Roofing', 'General Contractor',
  'Landscaping', 'Pest Control', 'Home Services', 'Cleaning Services',
  'Moving Company', 'Construction',
  -- New taxonomy verticals (future-proof)
  'Plumber', 'HVAC Contractor', 'Electrician', 'Roofer', 'Landscaper',
  'Pest Control Service', 'Home Remodeler', 'Kitchen Remodeler',
  'Bathroom Remodeler', 'Painter', 'Flooring Contractor', 'Lawn Care Service',
  'Tree Service', 'Pool Service', 'Fence Contractor', 'Garage Door Supplier',
  'Window Installer', 'Siding Contractor', 'Concrete Contractor',
  'Masonry Contractor', 'Foundation Repair', 'Waterproofing Company',
  'Insulation Contractor', 'Solar Energy Company', 'Septic System Service',
  'Well Drilling Contractor', 'Excavating Contractor', 'Demolition Contractor',
  'Paving Contractor', 'Deck Builder', 'Cabinet Maker', 'Countertop Installer',
  'Handyman', 'Locksmith', 'Appliance Repair Service', 'Cleaning Service',
  'Carpet Cleaning Service', 'Pressure Washing Service', 'Junk Removal Service',
  'Fire & Water Restoration'
) AND "industrySector" IS NULL;

-- Health & Medical
UPDATE "Client" SET "industrySector" = 'Health & Medical'
WHERE "industryVertical" IN (
  'Medical', 'Dental',
  'General Dentist', 'Cosmetic Dentist', 'Orthodontist', 'Oral Surgeon',
  'Pediatric Dentist', 'Dental Implant Provider', 'Chiropractor',
  'Physical Therapist', 'Dermatologist', 'Optometrist', 'Ophthalmologist',
  'Podiatrist', 'Orthopedic Surgeon', 'Urgent Care Center', 'Family Medicine',
  'Internal Medicine', 'Pediatrician', 'OB/GYN', 'Cardiologist', 'Psychiatrist',
  'Psychologist / Therapist', 'Med Spa', 'Plastic Surgeon', 'Pain Management',
  'Hearing Aid Provider', 'Home Health Care', 'Veterinarian', 'Pharmacy',
  'Acupuncturist', 'Speech Therapist', 'Occupational Therapist',
  'Addiction Treatment Center'
) AND "industrySector" IS NULL;

-- Legal
UPDATE "Client" SET "industrySector" = 'Legal'
WHERE "industryVertical" IN (
  'Legal',
  'Personal Injury Attorney', 'Family Law Attorney', 'Criminal Defense Attorney',
  'Immigration Attorney', 'Bankruptcy Attorney', 'Estate Planning Attorney',
  'Employment Attorney', 'Business / Corporate Attorney', 'Real Estate Attorney',
  'Tax Attorney', 'DUI Attorney', 'Workers'' Compensation Attorney',
  'Intellectual Property Attorney', 'General Practice Attorney'
) AND "industrySector" IS NULL;

-- Financial & Professional Services
UPDATE "Client" SET "industrySector" = 'Financial & Professional Services'
WHERE "industryVertical" IN (
  'Accounting / CPA', 'Accounting', 'Insurance', 'Financial Services',
  'Professional Services', 'Web Development', 'Marketing / Advertising',
  'CAD / Engineering', 'Architecture',
  'CPA / Accounting Firm', 'Bookkeeper', 'Tax Preparation Service',
  'Financial Advisor', 'Insurance Agency', 'Mortgage Broker',
  'Business Consultant', 'HR / Staffing Agency', 'IT Services / MSP',
  'Marketing Agency', 'Web Design / Development Agency',
  'Graphic Design Studio', 'Video Production Company',
  'Translation / Interpreting Service'
) AND "industrySector" IS NULL;

-- Real Estate & Property
UPDATE "Client" SET "industrySector" = 'Real Estate & Property'
WHERE "industryVertical" IN (
  'Real Estate',
  'Real Estate Agent', 'Property Management Company', 'Real Estate Developer',
  'Commercial Real Estate Broker', 'Mortgage Lender', 'Title Company',
  'Home Inspector', 'Appraiser', 'Real Estate Photographer', 'Storage Facility'
) AND "industrySector" IS NULL;

-- Personal Care & Wellness
UPDATE "Client" SET "industrySector" = 'Personal Care & Wellness'
WHERE "industryVertical" IN (
  'Salon / Barber', 'Fitness',
  'Hair Salon', 'Barbershop', 'Nail Salon', 'Day Spa', 'Massage Therapist',
  'Personal Trainer', 'Gym / Fitness Center', 'Yoga Studio', 'Pilates Studio',
  'Martial Arts School', 'Weight Loss Service', 'Tattoo Shop', 'Esthetician',
  'Lash & Brow Studio'
) AND "industrySector" IS NULL;

-- Automotive
UPDATE "Client" SET "industrySector" = 'Automotive'
WHERE "industryVertical" IN (
  'Auto Repair', 'Automotive',
  'Auto Repair Shop', 'Auto Body Shop', 'Tire Shop', 'Car Dealership',
  'Used Car Dealer', 'Auto Detailing Service', 'Towing Service',
  'Transmission Repair', 'Auto Glass Repair', 'Car Wash'
) AND "industrySector" IS NULL;

-- Food & Hospitality
UPDATE "Client" SET "industrySector" = 'Food & Hospitality'
WHERE "industryVertical" IN (
  'Restaurant',
  'Catering Service', 'Bakery', 'Food Truck', 'Coffee Shop', 'Bar / Nightclub',
  'Hotel / Motel', 'Bed & Breakfast', 'Event Venue', 'Wedding Venue',
  'Party / Event Planner', 'DJ / Entertainment Service'
) AND "industrySector" IS NULL;

-- Retail & E-commerce
UPDATE "Client" SET "industrySector" = 'Retail & E-commerce'
WHERE "industryVertical" IN (
  'E-commerce',
  'Clothing Store', 'Jewelry Store', 'Furniture Store', 'Pet Store', 'Florist',
  'Gift Shop', 'Liquor Store', 'Smoke Shop / Vape Shop', 'Electronics Store',
  'E-commerce Store'
) AND "industrySector" IS NULL;

-- B2B Services
UPDATE "Client" SET "industrySector" = 'B2B Services'
WHERE "industryVertical" IN (
  'Technology / SaaS',
  'Commercial Cleaning', 'Commercial HVAC', 'Commercial Roofing',
  'Janitorial Service', 'Waste Management', 'Commercial Landscaping',
  'Security Guard Service', 'Commercial Pest Control', 'Printing / Sign Company',
  'Industrial Equipment Supplier', 'Freight / Logistics', 'SaaS / Software Company'
) AND "industrySector" IS NULL;

-- Education & Training
UPDATE "Client" SET "industrySector" = 'Education & Training'
WHERE "industryVertical" IN (
  'Education / Training',
  'Private School / Academy', 'Tutoring Service', 'Driving School',
  'Music School', 'Dance Studio', 'Preschool / Daycare', 'Language School',
  'Trade School'
) AND "industrySector" IS NULL;

-- Nonprofit
UPDATE "Client" SET "industrySector" = 'Nonprofit'
WHERE "industryVertical" IN (
  'Charitable Organization', 'Church / Religious Organization',
  'Community Organization', 'Animal Rescue / Shelter'
) AND "industrySector" IS NULL;

-- Anything with an industryVertical that didn't match above gets "Other"
UPDATE "Client" SET "industrySector" = 'Other'
WHERE "industryVertical" IS NOT NULL
  AND "industryVertical" != ''
  AND "industrySector" IS NULL;
