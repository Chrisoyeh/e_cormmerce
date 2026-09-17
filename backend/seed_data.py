from sqlalchemy.orm import Session
from backend.models import Pupil, BookItem, Order, AppNotification, ContactSubmission

INITIAL_PUPILS = [
    {
        "id": "std1",
        "surname": "Okon",
        "firstName": "Daniel",
        "regNo": "NS/2026/001",
        "classLevel": "Primary 1",
        "parentName": "Mrs. Okon",
        "parentPhone": "+234 802 123 4567",
        "parentEmail": "okon.parent@example.com"
    },
    {
        "id": "std2",
        "surname": "Adeyemi",
        "firstName": "Sophia",
        "regNo": "NS/2026/002",
        "classLevel": "Primary 1",
        "parentName": "Engr. Adeyemi",
        "parentPhone": "+234 803 987 6543",
        "parentEmail": "adeyemi.parent@example.com"
    },
    {
        "id": "std3",
        "surname": "Chukwu",
        "firstName": "Michael",
        "regNo": "NS/2026/003",
        "classLevel": "Primary 2",
        "parentName": "Chief Chukwu",
        "parentPhone": "+234 809 555 1212",
        "parentEmail": "chukwu.parent@example.com"
    },
    {
        "id": "std4",
        "surname": "Smith",
        "firstName": "Preston",
        "regNo": "NS/2026/004",
        "classLevel": "Prep 2",
        "parentName": "Olivia Smith",
        "parentPhone": "+44 7911 123456",
        "parentEmail": "smith.parent@example.com"
    },
    {
        "id": "std5",
        "surname": "Musa",
        "firstName": "Ibrahim",
        "regNo": "NS/2026/005",
        "classLevel": "Primary 6",
        "parentName": "Dr. Musa",
        "parentPhone": "+234 905 777 8888",
        "parentEmail": "musa.parent@example.com"
    }
]

INITIAL_BOOKS = [
    # Pre-Nursery
    {"id": "pn-bk1", "title": "First Words Picture Dictionary", "author": "Nazareth Academic Press", "price": 15.0, "classLevel": "Pre-Nursery", "category": "Textbook", "stock": 150, "description": "A vibrant picture dictionary designed to help pre-nursery pupils learn letters and first words through captivating visual associations."},
    {"id": "pn-bk2", "title": "Early Numbers & Counting Workbook", "author": "Nazareth Academic Press", "price": 14.0, "classLevel": "Pre-Nursery", "category": "Textbook", "stock": 150, "description": "Foundational numeracy workbook with tactile tracing and visual counting for pre-nursery learners."},
    {"id": "pn-bk3", "title": "Fun with Finger Painting & Sensory Art", "author": "Nazareth Art Dept", "price": 8.5, "classLevel": "Pre-Nursery", "category": "Stationery", "stock": 200, "description": "Trace-free non-toxic coloring and finger painting sheets optimized for tiny hands."},

    # Kindergarten
    {"id": "kg-bk1", "title": "Active Math Basics for KG", "author": "Dr. Evelyn Thomas", "price": 18.5, "classLevel": "Kindergarten", "category": "Textbook", "stock": 150, "description": "An interactive early mathematics book featuring shape matching, numbers 1-50, and visual counting blocks."},
    {"id": "kg-bk2", "title": "Phonics Journey Stage 1", "author": "Clara Jenkins", "price": 16.0, "classLevel": "Kindergarten", "category": "Textbook", "stock": 150, "description": "Introduction to phonics sounds, simple blend vowels, and basic sight words with colorful illustrations."},
    {"id": "kg-bk3", "title": "Early Science & Nature Discovery for KG", "author": "Prof. Helen Clark", "price": 17.0, "classLevel": "Kindergarten", "category": "Textbook", "stock": 150, "description": "Introductory nature exploration covering weather, plants, senses, and everyday animals."},

    # Prep 1
    {"id": "p1-bk1", "title": "Beginning English Reader (Prep 1)", "author": "M. S. Alabi", "price": 20.0, "classLevel": "Prep 1", "category": "Textbook", "stock": 150, "description": "Carefully curated stories with short, high-frequency sentences to build early reading fluency."},
    {"id": "p1-bk2", "title": "Prep 1 Early Mathematics & Numbers", "author": "Dr. Evelyn Thomas", "price": 20.0, "classLevel": "Prep 1", "category": "Textbook", "stock": 150, "description": "Early addition, subtraction, clock reading, and pattern identification for Prep 1 pupils."},
    {"id": "p1-bk3", "title": "Prep 1 Science & World Exploration", "author": "Prof. Helen Clark", "price": 18.0, "classLevel": "Prep 1", "category": "Textbook", "stock": 150, "description": "Engaging fundamental science lessons introducing the environment, human body, and living things."},

    # Prep 2
    {"id": "p2-bk1", "title": "Prep 2 Phonics & Early Reading Reader", "author": "Clara Jenkins", "price": 22.0, "classLevel": "Prep 2", "category": "Textbook", "stock": 150, "description": "Advanced phonics reader with compound words, comprehension stories, and vocabulary building."},
    {"id": "p2-bk2", "title": "Prep 2 Mathematics & Basic Geometry", "author": "Dr. Evelyn Thomas", "price": 22.0, "classLevel": "Prep 2", "category": "Textbook", "stock": 150, "description": "Comprehensive pre-primary mathematics workbook introducing measurement, shapes, and word problems."},
    {"id": "p2-bk3", "title": "Prep 2 Living Things & Science Exploration", "author": "Prof. Helen Clark", "price": 20.0, "classLevel": "Prep 2", "category": "Textbook", "stock": 150, "description": "Hands-on discovery curriculum covering habitats, physical materials, and healthy living."},
    {"id": "p2-bk4", "title": "Write-In Cursive Guide (Prep 2)", "author": "Nazareth Handwriting Faculty", "price": 12.0, "classLevel": "Prep 2", "category": "Notebook", "stock": 200, "description": "Step-by-step cursive tracing workbook designed to prepare pupils for core primary levels."},

    # Primary 1
    {"id": "pri1-bk1", "title": "Primary Mathematics Book 1", "author": "Oxford University Press", "price": 25.5, "classLevel": "Primary 1", "category": "Textbook", "stock": 150, "description": "Comprehensive mathematics textbook aligning with the national curriculum. Covers addition, subtraction, and basic shapes."},
    {"id": "pri1-bk2", "title": "Primary English Language & Literacy 1", "author": "Clara Jenkins & M. S. Alabi", "price": 25.0, "classLevel": "Primary 1", "category": "Textbook", "stock": 150, "description": "Core English grammar, spelling rules, comprehension passages, and sentence building for Primary 1."},
    {"id": "pri1-bk3", "title": "Basic Science and Technology 1", "author": "Prof. Helen Clark", "price": 24.0, "classLevel": "Primary 1", "category": "Textbook", "stock": 150, "description": "Foundational science and basic computing guide introducing living things, materials, and technology."},
    {"id": "pri1-bk4", "title": "Social Studies & Civic Habits 1", "author": "A. G. Yusuf", "price": 22.0, "classLevel": "Primary 1", "category": "Textbook", "stock": 150, "description": "Community roles, safety rules, good citizenship habits, and cultural appreciation."},
    {"id": "pri1-bk5", "title": "Nazareth Custom Drawing Book (P1)", "author": "Nazareth School Admin", "price": 6.0, "classLevel": "Primary 1", "category": "Notebook", "stock": 200, "description": "Official school drawing book designed specifically for creative studies in Primary 1."},

    # Primary 2
    {"id": "pri2-bk1", "title": "Primary Mathematics Book 2", "author": "Oxford University Press", "price": 26.0, "classLevel": "Primary 2", "category": "Textbook", "stock": 150, "description": "Multiplication basics, division introduction, place value, and currency arithmetic for Primary 2."},
    {"id": "pri2-bk2", "title": "Primary English Language & Comprehension 2", "author": "Clara Jenkins", "price": 25.5, "classLevel": "Primary 2", "category": "Textbook", "stock": 150, "description": "Grammar mechanics, parts of speech, vocabulary expansion, and reading comprehension."},
    {"id": "pri2-bk3", "title": "Science and Nature for Young Minds 2", "author": "Prof. Helen Clark", "price": 28.0, "classLevel": "Primary 2", "category": "Textbook", "stock": 150, "description": "Engaging elementary science book exploring animals, plant biology, weather, and physical world basics."},
    {"id": "pri2-bk4", "title": "Social Studies & Cultural Heritage 2", "author": "A. G. Yusuf", "price": 22.5, "classLevel": "Primary 2", "category": "Textbook", "stock": 150, "description": "Exploring family origins, community institutions, leadership, and national holidays."},

    # Primary 3
    {"id": "pri3-bk1", "title": "Primary Mathematics Book 3", "author": "Oxford University Press", "price": 27.0, "classLevel": "Primary 3", "category": "Textbook", "stock": 150, "description": "Fractions, word problems, 2D/3D shapes, time measurement, and data handling for Primary 3."},
    {"id": "pri3-bk2", "title": "Primary English & Creative Writing 3", "author": "Reginald Vance", "price": 26.0, "classLevel": "Primary 3", "category": "Textbook", "stock": 150, "description": "Paragraph construction, punctuation mastery, story development, and comprehension skills."},
    {"id": "pri3-bk3", "title": "Basic Science & Agricultural Studies 3", "author": "Prof. Helen Clark", "price": 25.0, "classLevel": "Primary 3", "category": "Textbook", "stock": 150, "description": "Soil types, simple machines, plant growth cycles, and environmental safety."},
    {"id": "pri3-bk4", "title": "Social Studies & Citizenship 3", "author": "A. G. Yusuf", "price": 22.0, "classLevel": "Primary 3", "category": "Textbook", "stock": 150, "description": "Learn about community structure, basic national history, roles and duties of active citizens."},

    # Primary 4
    {"id": "pri4-bk1", "title": "Primary Mathematics Book 4", "author": "Oxford University Press", "price": 28.0, "classLevel": "Primary 4", "category": "Textbook", "stock": 150, "description": "Decimals, factors, multiples, perimeter, area, and advanced long division."},
    {"id": "pri4-bk2", "title": "Primary English Language & Composition 4", "author": "Reginald Vance", "price": 27.5, "classLevel": "Primary 4", "category": "Textbook", "stock": 150, "description": "Essay writing, advanced vocabulary, formal letter drafting, and grammar precision."},
    {"id": "pri4-bk3", "title": "Basic Science & Technology 4", "author": "Prof. Helen Clark", "price": 26.5, "classLevel": "Primary 4", "category": "Textbook", "stock": 150, "description": "Energy forms, water purification, computer software basics, and human body systems."},
    {"id": "pri4-bk4", "title": "Quantitative & Verbal Reasoning 4", "author": "K. S. Cole", "price": 24.0, "classLevel": "Primary 4", "category": "Textbook", "stock": 150, "description": "A test-prep style guide that instills deep critical thinking, pattern reasoning, and English analogy tools."},
    {"id": "pri4-bag", "title": "Nazareth School Branded Backpack", "author": "Official Wear Division", "price": 45.0, "classLevel": "Primary 4", "category": "Utility", "stock": 100, "description": "Ergonomic, water-resistant navy blue backpack displaying the embroidered Nazareth School gold crest."},

    # Primary 5
    {"id": "pri5-bk1", "title": "Primary Mathematics Book 5", "author": "Dr. A. O. Bello", "price": 29.0, "classLevel": "Primary 5", "category": "Textbook", "stock": 150, "description": "Percentages, ratios, algebraic expressions, angles, volume, and statistics."},
    {"id": "pri5-bk2", "title": "Advanced Primary English Grammar 5", "author": "Reginald Vance", "price": 27.5, "classLevel": "Primary 5", "category": "Textbook", "stock": 150, "description": "Core syntax, sentence formulation, parts of speech, and comprehensive essay writing benchmarks."},
    {"id": "pri5-bk3", "title": "Basic Science, ICT & Robotics 5", "author": "Prof. Helen Clark", "price": 28.0, "classLevel": "Primary 5", "category": "Textbook", "stock": 150, "description": "Electricity, magnetism, coding fundamentals, environmental balance, and science lab safety."},
    {"id": "pri5-bk4", "title": "Quantitative & Verbal Reasoning 5", "author": "K. S. Cole", "price": 25.0, "classLevel": "Primary 5", "category": "Textbook", "stock": 150, "description": "Upper primary aptitude drills, logical sequences, verbal puzzles, and critical deduction."},
    {"id": "pri5-tin", "title": "Premium Compass & Drafting Tin", "author": "Helix Stationery", "price": 10.5, "classLevel": "Primary 5", "category": "Stationery", "stock": 150, "description": "A comprehensive geometry and stationery pencil tin with essential drafting tools."},

    # Primary 6
    {"id": "pri6-bk1", "title": "Junior High Transition Mathematics 6", "author": "Mary Baker & Dr. A. O. Bello", "price": 32.0, "classLevel": "Primary 6", "category": "Textbook", "stock": 150, "description": "Capstone math textbook designed to prepare Nazareth School seniors for secondary board entrance testing."},
    {"id": "pri6-bk2", "title": "Senior Primary English Masterclass 6", "author": "Reginald Vance", "price": 30.0, "classLevel": "Primary 6", "category": "Textbook", "stock": 150, "description": "Comprehensive literary appreciation, persuasive writing, argumentative essays, and national examination prep."},
    {"id": "pri6-bk3", "title": "Basic Science & Technology Capstone 6", "author": "Prof. Helen Clark", "price": 29.0, "classLevel": "Primary 6", "category": "Textbook", "stock": 150, "description": "Comprehensive revision of primary science, solar system, technology systems, and health."},
    {"id": "pri6-bk4", "title": "National Common Entrance Exam Prep & Reasoning 6", "author": "Academic Board", "price": 35.0, "classLevel": "Primary 6", "category": "Textbook", "stock": 150, "description": "Full mock examinations, past question series, and time-management strategies for senior exams."},

    # All Classes
    {"id": "uni-01", "title": "Nazareth School Uniform Set (Boys)", "author": "Nazareth Tailoring", "price": 45.0, "classLevel": "All Classes", "category": "Uniform", "stock": 200, "description": "Custom crest blazer, tailored shorts, and collared shirt.", "uniformSize": "Size 8 (Ages 6-8)"},
    {"id": "uni-02", "title": "Nazareth School Uniform Set (Girls)", "author": "Nazareth Tailoring", "price": 45.0, "classLevel": "All Classes", "category": "Uniform", "stock": 200, "description": "Custom crest pinafore dress with branded trim.", "uniformSize": "Size 8 (Ages 6-8)"}
]

INITIAL_NOTIFICATIONS = [
    {
        "id": "not1",
        "title": "Term 1 School Store Portal Active",
        "message": "Welcome to the new digital ledger system. Parents can purchase materials directly.",
        "type": "info",
        "timestamp": "2026-09-01T08:00:00Z",
        "read": False,
        "role": "all",
        "recipientId": "all"
    },
    {
        "id": "not2",
        "title": "Welcome to Nazareth School Portal",
        "message": "Your profile has been registered in the student academic registry.",
        "type": "success",
        "timestamp": "2026-09-02T10:00:00Z",
        "read": False,
        "role": "pupil",
        "recipientId": "all"
    }
]

def seed_database_if_empty(db: Session):
    """
    Seeds initial catalog and pupil records if tables are empty.
    """
    try:
        # 1. Books / Catalog
        if db.query(BookItem).count() == 0:
            print(f"[Seed] Seeding database with {len(INITIAL_BOOKS)} initial core textbooks...")
            for b in INITIAL_BOOKS:
                db.add(BookItem(**b))
            db.commit()

        # 2. Pupils
        if db.query(Pupil).count() == 0:
            print(f"[Seed] Seeding database with {len(INITIAL_PUPILS)} initial sample pupils...")
            for p in INITIAL_PUPILS:
                db.add(Pupil(**p))
            db.commit()

        # 3. Notifications
        if db.query(AppNotification).count() == 0:
            for n in INITIAL_NOTIFICATIONS:
                db.add(AppNotification(**n))
            db.commit()

        print("[Seed] Database initial verification complete.")
    except Exception as e:
        db.rollback()
        print(f"[Seed] Warning during initial seeding: {e}")
