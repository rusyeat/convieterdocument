"""Builds the synthetic training dataset for the document-type classifier.

Why synthetic: real contracts, CVs and invoices contain personal data (names, IIN,
addresses, bank details). Under the Digital Code of the RK (No. 255-VIII) and the
course data-security rules such data must not be put in a public repository. So
every sample here is assembled from hand-written, generic sentences in Kazakh,
Russian and English. No real person or organisation appears in the data.

Each sample = 3-6 random sentences of one class + 0-2 "neutral" sentences shared
by all classes (dates, page numbers, greetings), so the model cannot rely on
trivial cues. Fixed seed -> the file is identical on every run.

Run:  uv run --python 3.12 --with-requirements ml/requirements.txt ml/make_dataset.py
"""
import csv
import random
from pathlib import Path

SEED = 42
PER_CLASS_PER_LANG = 60
OUT = Path(__file__).parent / "data" / "train.csv"

POOL = {
    "contract": {
        "kk": [
            "Осы келісімшарт тараптар арасында жасалды.", "Тапсырыс беруші мен Орындаушы төмендегілер туралы келісті.",
            "Келісімшарттың мәні: Орындаушы қызмет көрсетуге міндеттенеді.", "Тараптардың құқықтары мен міндеттері.",
            "Келісімшарт қол қойылған күннен бастап күшіне енеді.", "Тараптардың жауапкершілігі және дауларды шешу тәртібі.",
            "Форс-мажор жағдайлары туындаған кезде тараптар жауапкершіліктен босатылады.", "Шарттың құны 500 000 теңгені құрайды.",
            "Келісімшарт екі данада жасалды, әр тарапқа бір данадан.", "Тараптардың деректемелері және қолдары.",
            "Жалға беруші пәтерді жалға алушыға уақытша пайдалануға береді.", "Шартты мерзімінен бұрын бұзу тәртібі.",
            "Сатушы тауарды сатып алушыға меншікке беруге міндеттенеді.", "Құпиялылық туралы келісім талаптары.",
        ],
        "ru": [
            "Настоящий договор заключен между сторонами.", "Заказчик и Исполнитель заключили настоящий договор о нижеследующем.",
            "Предмет договора: Исполнитель обязуется оказать услуги.", "Права и обязанности сторон.",
            "Договор вступает в силу с момента подписания.", "Ответственность сторон и порядок разрешения споров.",
            "Стороны освобождаются от ответственности при форс-мажорных обстоятельствах.", "Стоимость услуг по договору составляет 500 000 тенге.",
            "Договор составлен в двух экземплярах, имеющих равную юридическую силу.", "Реквизиты и подписи сторон.",
            "Арендодатель передает квартиру арендатору во временное пользование.", "Порядок досрочного расторжения договора.",
            "Продавец обязуется передать товар в собственность покупателя.", "Условия соглашения о конфиденциальности.",
        ],
        "en": [
            "This agreement is made between the parties.", "The Client and the Contractor agree as follows.",
            "Subject of the agreement: the Contractor shall provide the services.", "Rights and obligations of the parties.",
            "This agreement enters into force on the date of signing.", "Liability of the parties and dispute resolution.",
            "Neither party shall be liable for failure caused by force majeure.", "The total contract price is 5,000 USD.",
            "This agreement is executed in two counterparts.", "Details and signatures of the parties.",
            "The Landlord leases the apartment to the Tenant.", "Terms of early termination of the agreement.",
            "The Seller agrees to transfer ownership of the goods to the Buyer.", "Confidentiality and non-disclosure terms.",
        ],
    },
    "application": {
        "kk": [
            "Директорға", "Өтініш", "Маған еңбек демалысын беруіңізді сұраймын.", "Мені жұмысқа қабылдауыңызды сұраймын.",
            "Сізден анықтама беруіңізді өтінемін.", "Мені өз еркіммен жұмыстан босатуыңызды сұраймын.",
            "Баламды мектепке қабылдауыңызды сұраймын.", "Жатақханадан орын беруіңізді өтінемін.",
            "Өтінішке құжаттардың көшірмелері қоса беріледі.", "Ректордың атына өтініш.", "Мені оқудан академиялық демалысқа жіберуіңізді сұраймын.",
            "Өтініш берушінің аты-жөні және қолы.", "Төлемді қайтаруыңызды сұраймын.", "Құжаттарды қабылдауыңызды өтінемін.",
        ],
        "ru": [
            "Директору", "Заявление", "Прошу предоставить мне ежегодный оплачиваемый отпуск.", "Прошу принять меня на работу на должность.",
            "Прошу выдать мне справку с места учебы.", "Прошу уволить меня по собственному желанию.",
            "Прошу зачислить моего ребенка в первый класс.", "Прошу предоставить место в общежитии.",
            "К заявлению прилагаю копии документов.", "Ректору университета от студента.", "Прошу предоставить академический отпуск.",
            "ФИО и подпись заявителя.", "Прошу вернуть денежные средства.", "Прошу принять документы к рассмотрению.",
        ],
        "en": [
            "To the Director", "Application", "I kindly request annual leave.", "I am applying for the position of assistant.",
            "Please issue me a certificate of enrolment.", "I hereby request to resign from my position.",
            "I request admission of my child to the first grade.", "I apply for a place in the student dormitory.",
            "Copies of the documents are attached to this application.", "Application to the Rector from a student.", "I request academic leave.",
            "Name and signature of the applicant.", "I request a refund of the payment.", "Please accept my documents for review.",
        ],
    },
    "invoice": {
        "kk": [
            "Шот-фактура", "Төлемге арналған шот", "Тауардың атауы, саны, бағасы, сомасы.", "Барлығы төлеуге: 125 000 теңге.",
            "ҚҚС 12% қоса алғанда.", "Жеткізуші: ЖШС, БСН 123456789012.", "Сатып алушы: ЖК.", "Банк: ИИК KZ00 0000 0000 0000.",
            "Төлем мерзімі: шот берілген күннен бастап 5 банктік күн.", "Орындалған жұмыстар актісі.", "Тауар жүкқұжаты.",
            "Бірлік бағасы: 2 500 теңге.", "Жеңілдік: 10%.", "Төлем тағайындалуы: қызметтер үшін.",
        ],
        "ru": [
            "Счет-фактура", "Счет на оплату", "Наименование товара, количество, цена, сумма.", "Итого к оплате: 125 000 тенге.",
            "В том числе НДС 12%.", "Поставщик: ТОО, БИН 123456789012.", "Покупатель: ИП.", "Банк: ИИК KZ00 0000 0000 0000.",
            "Срок оплаты: 5 банковских дней с даты выставления счета.", "Акт выполненных работ.", "Товарная накладная.",
            "Цена за единицу: 2 500 тенге.", "Скидка: 10%.", "Назначение платежа: оплата услуг.",
        ],
        "en": [
            "Invoice", "Invoice number INV-0042", "Item description, quantity, unit price, amount.", "Total amount due: 1,250.00 USD.",
            "VAT 12% included.", "Supplier: LLP, tax ID 123456789012.", "Bill to: customer.", "Bank: IBAN KZ00 0000 0000 0000.",
            "Payment due within 5 business days.", "Certificate of completed works.", "Delivery note.",
            "Unit price: 25.00 USD.", "Discount: 10%.", "Payment reference: services.",
        ],
    },
    "resume": {
        "kk": [
            "Түйіндеме", "Жұмыс тәжірибесі", "Білімі: бакалавр, ақпараттық жүйелер.", "Кәсіби дағдылар: Python, SQL, Excel.",
            "Тілдерді меңгеруі: қазақ тілі — ана тілі, орыс тілі — еркін, ағылшын тілі — B2.", "Байланыс ақпараты: телефон, электрондық пошта.",
            "Мақсаты: бағдарламашы лауазымына орналасу.", "Жеке қасиеттері: жауапкершілік, командада жұмыс істей білу.",
            "Сертификаттар мен курстар.", "Жетістіктері: жобаны мерзімінен бұрын аяқтадым.", "2022–2024 жж. — кіші талдаушы.",
            "Хоббиі: шахмат, кітап оқу.", "Портфолио сілтемесі.", "Ұсынымдар сұрау бойынша беріледі.",
        ],
        "ru": [
            "Резюме", "Опыт работы", "Образование: бакалавр, информационные системы.", "Профессиональные навыки: Python, SQL, Excel.",
            "Знание языков: казахский — родной, русский — свободно, английский — B2.", "Контактная информация: телефон, электронная почта.",
            "Цель: соискание должности программиста.", "Личные качества: ответственность, умение работать в команде.",
            "Сертификаты и курсы.", "Достижения: завершил проект раньше срока.", "2022–2024 гг. — младший аналитик.",
            "Хобби: шахматы, чтение.", "Ссылка на портфолио.", "Рекомендации предоставляются по запросу.",
        ],
        "en": [
            "Curriculum Vitae", "Work experience", "Education: BSc in Information Systems.", "Skills: Python, SQL, Excel.",
            "Languages: Kazakh — native, Russian — fluent, English — B2.", "Contact: phone, email, LinkedIn.",
            "Objective: to obtain a position as a software developer.", "Personal qualities: responsible, team player.",
            "Certificates and courses.", "Achievements: delivered the project ahead of schedule.", "2022–2024 — Junior Analyst.",
            "Hobbies: chess, reading.", "Portfolio link.", "References available on request.",
        ],
    },
    "academic": {
        "kk": [
            "Аңдатпа", "Кіріспе", "Зерттеудің өзектілігі", "Зерттеу әдістері мен материалдары.", "Нәтижелер және талқылау.",
            "Қорытынды", "Пайдаланылған әдебиеттер тізімі", "Түйін сөздер: машиналық оқыту, деректерді талдау.",
            "Бұл мақалада ұсынылған әдістің тиімділігі қарастырылады.", "Эксперимент нәтижелері 1-кестеде келтірілген.",
            "Курстық жұмыстың мақсаты мен міндеттері.", "Ғылыми жетекші: т.ғ.к., доцент.", "Әдебиеттерге шолу.", "Гипотеза расталды.",
        ],
        "ru": [
            "Аннотация", "Введение", "Актуальность исследования", "Материалы и методы исследования.", "Результаты и обсуждение.",
            "Заключение", "Список использованной литературы", "Ключевые слова: машинное обучение, анализ данных.",
            "В статье рассматривается эффективность предложенного метода.", "Результаты эксперимента приведены в таблице 1.",
            "Цель и задачи курсовой работы.", "Научный руководитель: к.т.н., доцент.", "Обзор литературы.", "Гипотеза подтвердилась.",
        ],
        "en": [
            "Abstract", "Introduction", "Relevance of the study", "Materials and methods.", "Results and discussion.",
            "Conclusion", "References", "Keywords: machine learning, data analysis.",
            "This paper evaluates the effectiveness of the proposed method.", "Experimental results are shown in Table 1.",
            "Aims and objectives of the coursework.", "Supervisor: PhD, Associate Professor.", "Literature review.", "The hypothesis was confirmed.",
        ],
    },
    "letter": {
        "kk": [
            "Құрметті әріптестер!", "Хат", "Сіздің хатыңызға жауап ретінде хабарлаймыз.", "Сізді іс-шараға шақырамыз.",
            "Ынтымақтастығыңыз үшін алғыс білдіреміз.", "Ақпарат үшін хабарлаймыз.", "Құрметпен, бөлім басшысы.",
            "Шығыс нөмірі 01-15/245.", "Сұрағыңызды қарап, келесіні хабарлаймыз.", "Кездесу уақытын келісуді сұраймыз.",
            "Алғыс хат", "Ресми хат", "Сізбен әрі қарай жұмыс істеуге дайынбыз.", "Хатқа қосымша: 2 парақ.",
        ],
        "ru": [
            "Уважаемые коллеги!", "Письмо", "В ответ на Ваше письмо сообщаем следующее.", "Приглашаем Вас принять участие в мероприятии.",
            "Благодарим за сотрудничество.", "Доводим до Вашего сведения.", "С уважением, руководитель отдела.",
            "Исходящий номер 01-15/245.", "Рассмотрев Ваш запрос, сообщаем.", "Просим согласовать время встречи.",
            "Благодарственное письмо", "Официальное письмо", "Готовы к дальнейшему сотрудничеству.", "Приложение: 2 листа.",
        ],
        "en": [
            "Dear colleagues,", "Letter", "In reply to your letter, we would like to inform you.", "We are pleased to invite you to the event.",
            "Thank you for your cooperation.", "Please be informed that.", "Sincerely, Head of Department.",
            "Our reference 01-15/245.", "Having reviewed your request, we confirm.", "Please confirm a convenient meeting time.",
            "Letter of appreciation", "Official letter", "We look forward to working with you.", "Enclosure: 2 pages.",
        ],
    },
}

NEUTRAL = {
    "kk": ["Астана қаласы", "2026 жылғы 15 қазан", "1-бет", "Алматы", "Күні: ____", "Қолы: ____", "Байланыс телефоны"],
    "ru": ["г. Астана", "15 октября 2026 года", "Страница 1", "Алматы", "Дата: ____", "Подпись: ____", "Контактный телефон"],
    "en": ["Astana", "15 October 2026", "Page 1", "Almaty", "Date: ____", "Signature: ____", "Contact phone"],
}


def build(rng: random.Random):
    rows = []
    for label, langs in POOL.items():
        for lang, sentences in langs.items():
            for _ in range(PER_CLASS_PER_LANG):
                parts = rng.sample(sentences, rng.randint(3, 6)) + rng.sample(NEUTRAL[lang], rng.randint(0, 2))
                rng.shuffle(parts)
                rows.append({"text": " ".join(parts), "label": label, "lang": lang})
    rng.shuffle(rows)
    return rows


if __name__ == "__main__":
    rows = build(random.Random(SEED))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["text", "label", "lang"])
        w.writeheader()
        w.writerows(rows)
    print(f"wrote {len(rows)} rows to {OUT}")
