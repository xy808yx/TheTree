// A small but deliberately messy sample family, used for the first-run demo
// and for verification. A hypothetical Cantonese diaspora family from the
// Pearl River Delta (Siyi / 四邑) — branches through Singapore, Penang, Hong
// Kong, Saigon, Liverpool, London, San Francisco, and Vancouver across four
// generations. Exercises: remarriage, adoption, step-child, half-sibling,
// unknown parentage, partial/approximate dates, namespaced tags, tagged
// lessons/mistakes, and (for the map) birth/death coordinates. Each child is
// listed in exactly one union (their parents_union).

import { parseDoc } from './parse.js';

const FILES = [
  // ---- Generation 1: village roots in the Pearl River Delta (and one who never came back) ----
  `---
id: p-ahfook
slug: wong-ah-fook
names: { display: "Wong Ah-fook", given: "Ah-fook", family: "Wong", also_known_as: ["黃亞福"] }
sex: M
birth: { date: "abt 1858", place: "Taishan, Guangdong", lat: 22.252, lng: 112.793 }
death: { date: "1920", place: "Taishan, Guangdong", lat: 22.252, lng: 112.793 }
living: false
tags: { talent: ["calligraphy", "teaching"] }
unions: ["u-ahfook-muilan"]
parents_union: null
---
## Story
The village schoolmaster of a small Toishan hamlet. Never travelled further
than Guangzhou; insisted that every child in the family — sons and daughters
both — learn to read and write.

## Lessons & Mistakes
- {lesson: work} "Teach a daughter to read and you teach two generations." He charged half-fees for girls when the village called the practice wasteful.`,

  `---
id: p-muilan
slug: li-mui-lan
names: { display: "Li Mui-lan", given: "Mui-lan", family: "Li", also_known_as: ["李梅蘭"] }
sex: F
birth: { date: "abt 1862", place: "Kaiping, Guangdong", lat: 22.378, lng: 112.679 }
death: { date: "1928", place: "Taishan, Guangdong", lat: 22.252, lng: 112.793 }
living: false
tags: { faith: ["ancestor-veneration"] }
unions: ["u-ahfook-muilan"]
parents_union: null
---
## Story
Daughter of a Hoiping merchant; bound feet. Married into the Wong household at
seventeen. Kept the family altar through famine, plague, and the collapse of
the Qing.

## Lessons & Mistakes
- {lesson: faith} Lit incense for the ancestors every dawn for sixty-one years. "If you forget who came before, you become no one to those who come after."`,

  `---
id: p-kwokkeung
slug: chan-kwok-keung
names: { display: "Chan Kwok-keung", given: "Kwok-keung", family: "Chan", also_known_as: ["陳國強", "Kwok"] }
sex: M
birth: { date: "1864", place: "Xinhui, Guangdong", lat: 22.458, lng: 113.082 }
death: { date: "1898", place: "San Francisco, California", lat: 37.775, lng: -122.419 }
living: false
unions: ["u-kwokkeung-yuething"]
parents_union: null
---
## Story
Sailed for Gold Mountain in 1884, leaving a young wife and an infant daughter
behind in Sunwui. Worked the Sierra placer claims and later a Chinatown
laundry. Killed in a tenement fire on Jackson Street, age 34. Sent home
silver every spring; never came back.

## Lessons & Mistakes
- {mistake: relationships} Promised his wife he'd return in five years. Sent money for fourteen and never crossed the Pacific again. His daughter never met him.
- {mistake: money} Pooled his savings into a fellow countryman's "sure thing" import scheme the year before he died. Nothing reached the family.`,

  `---
id: p-yuething
slug: mok-yuet-hing
names: { display: "Mok Yuet-hing", given: "Yuet-hing", family: "Mok", also_known_as: ["莫月卿"] }
sex: F
birth: { date: "1867", place: "Xinhui, Guangdong", lat: 22.458, lng: 113.082 }
death: { date: "1942", place: "Liverpool, England", lat: 53.408, lng: -2.992 }
living: false
tags: { talent: ["embroidery"], faith: ["devout"] }
unions: ["u-kwokkeung-yuething"]
parents_union: null
---
## Story
Widowed at thirty-one by Kwok-keung's death on the other side of the Pacific.
Took the silver he had sent home and, with her brother already in the
Liverpool laundry trade, sailed for England in 1901 with her young daughter
Yuk-fan. Ran a boarding house off Pitt Street for forty years. Never re-married.

## Lessons & Mistakes
- {lesson: work} "When one road closes, walk another." Buried two husbands' worth of plans and crossed an ocean alone in her thirties to start a third life.
- {lesson: relationships} Wrote her brother a letter every Sunday for thirty years, even when there was nothing to say. He kept every one.`,

  // ---- Generation 2: the migration generation ----
  `---
id: p-tinbo
slug: wong-tin-bo
names: { display: "Wong Tin-bo", given: "Tin-bo", family: "Wong", also_known_as: ["黃天保"] }
sex: M
birth: { date: "1888", place: "Taishan, Guangdong", lat: 22.252, lng: 112.793 }
death: { date: "1956", place: "Singapore", lat: 1.290, lng: 103.851 }
living: false
tags: { talent: ["goldsmithing"] }
photos:
  - { file: "tinbo-shop-1937.jpg", caption: "Outside the Telok Ayer shop", date: "1937" }
unions: ["u-tinbo-yukfan"]
parents_union: "u-ahfook-muilan"
---
## Story
Apprenticed at fifteen to a goldsmith on Hollywood Road in Hong Kong, then
followed an uncle to Singapore in 1903 as a journeyman. Opened a small jewelry
shop on Telok Ayer Street in 1912 that survived the Depression, the Japanese
occupation, and three children's school fees.

## Lessons & Mistakes
- {lesson: work} "An hour at the bench is an hour saved later." Refused to take shortcuts at the forge even on the simplest piece. His work passed inspection in three colonies.
- {lesson: money} Carried no debt his whole working life. "Owe no one — you can refuse any job and still sleep."`,

  `---
id: p-yukfan
slug: chan-yuk-fan
names: { display: "Chan Yuk-fan", given: "Yuk-fan", family: "Chan", also_known_as: ["陳玉芬", "Annie"] }
sex: F
birth: { date: "1893", place: "Liverpool, England", lat: 53.408, lng: -2.992 }
death: { date: "1965", place: "Singapore", lat: 1.290, lng: 103.851 }
living: false
tags: { talent: ["languages"], faith: ["devout"] }
unions: ["u-tinbo-yukfan"]
parents_union: "u-kwokkeung-yuething"
---
## Story
Born in Liverpool's Chinatown six months after her mother arrived from
Sunwui. Grew up speaking Toishanese at home, Cantonese with her uncles, and
broad Scouse English in the street. A marriage was arranged through diaspora
networks; she sailed for Singapore at twenty to meet Wong Tin-bo for the
first time on her wedding day. Ran the shop ledger and translated for every
European customer who walked in.

## Lessons & Mistakes
- {lesson: work} "A woman with three languages is never alone." She handled the British colonial accounts, the Hokkien suppliers, and her in-laws' village letters — all from the same desk.`,

  // ---- Generation 3: the war and the second migration ----
  `---
id: p-hongkeung
slug: wong-hong-keung
names: { display: "Wong Hong-keung", given: "Hong-keung", family: "Wong", also_known_as: ["黃康強", "Henry"] }
sex: M
birth: { date: "1918-11-04", place: "Singapore", lat: 1.290, lng: 103.851 }
death: { date: "1985", place: "Vancouver, Canada", lat: 49.250, lng: -123.119 }
living: false
tags: { talent: ["medicine"], health: ["alcoholism-recovered"] }
photos:
  - { file: "hongkeung-1948.jpg", caption: "Hong Kong, after the war", date: "1948" }
unions: ["u-hongkeung-sauyi", "u-hongkeung-meiling"]
parents_union: "u-tinbo-yukfan"
---
## Story
Sent to Hong Kong at eighteen to study medicine. Fled the Japanese invasion
on the last boat out of Kowloon in December 1941, served as a medical officer
in the Pacific, and returned to a city he barely recognized. Widowed in 1947.
Emigrated to Vancouver in 1950 with a new wife and an infant daughter; built
a family practice in Chinatown that ran until the year he died.

## Lessons & Mistakes
- {lesson: work} Refused to specialise. "A neighbourhood doctor sees what hospitals never do — and they remember you for it for forty years."
- {mistake: health} Drank for a decade after the war to sleep through what he had seen on the hospital ships. Lost his savings, alienated his children, almost lost the practice. Stopped on his fiftieth birthday and never touched it again — but said the years he lost never came back.`,

  `---
id: p-sauyi
slug: lam-sau-yi
names: { display: "Lam Sau-yi", given: "Sau-yi", family: "Lam", also_known_as: ["林秀儀"] }
sex: F
birth: { date: "1916", place: "Hong Kong", lat: 22.302, lng: 114.169 }
death: { date: "1947", place: "Hong Kong", lat: 22.302, lng: 114.169 }
living: false
unions: ["u-hongkeung-sauyi"]
parents_union: null
---
## Story
Hong-keung's first wife. A primary-school teacher from a Hong Kong shopkeeper
family. They married in early 1946 in the rubble of the post-war city. She
died of cholera in the 1947 epidemic, eight months after their daughter
Ka-shing was born. Hong-keung carried her photograph in his wallet for the
remaining thirty-eight years of his life.`,

  `---
id: p-meiling
slug: lee-mei-ling
names: { display: "Lee Mei-ling", given: "Mei-ling", family: "Lee", maiden: "Lee", also_known_as: ["李美玲", "Mary"] }
sex: F
birth: { date: "1922-08-19", place: "George Town, Penang", lat: 5.414, lng: 100.330 }
death: { date: "2001", place: "Vancouver, Canada", lat: 49.250, lng: -123.119 }
living: false
tags: { talent: ["cooking"], faith: ["Buddhist"] }
unions: ["u-hongkeung-meiling"]
parents_union: null
---
## Story
Daughter of a Penang Peranakan jeweller. Met Hong-keung in Hong Kong in 1948
while visiting cousins; married within the year and raised his infant
daughter as her own. Followed him to Vancouver in 1950 with a Cantonese she
half-spoke and an English she barely had at all. Within fifteen years she
ran the shop floor of his clinic, kept the books for two restaurants, and
sat on the board of the Chinatown Benevolent Association.

## Lessons & Mistakes
- {lesson: relationships} "Silence at the dinner table is a discipline." Saved more marriages, she said, than any apology she ever heard.
- {lesson: faith} Lit a stick of sandalwood every morning before opening the curtains. "Before the day asks anything of you, give one thing to it freely."`,

  // ---- Generation 4: the focus generation ----
  `---
id: p-karen
slug: wong-ka-shing
names: { display: "Wong Ka-shing", given: "Ka-shing", family: "Wong", also_known_as: ["黃家成", "Karen"] }
sex: F
birth: { date: "1947-03-11", place: "Hong Kong", lat: 22.302, lng: 114.169 }
death: { date: "2018", place: "London, England", lat: 51.507, lng: -0.128 }
living: false
tags: { talent: ["law", "languages"] }
photos:
  - { file: "karen-call-1972.jpg", caption: "Called to the Bar, Gray's Inn", date: "1972" }
unions: []
parents_union: "u-hongkeung-sauyi"
---
## Story
Born eight months before her mother died. Carried across the Pacific by
Mei-ling at three, raised in Vancouver believing for years that Mei-ling
was her birth mother. Read law at the LSE on a Commonwealth scholarship,
called to the Bar in 1972, never left London. Spent a forty-year career on
immigration appeals — much of it for families with stories that began the
way hers did.

## Lessons & Mistakes
- {lesson: work} "Never argue when you can write a letter." Won three of her hardest cases on the strength of a single, slow, precise paragraph.
- {mistake: relationships} Refused to fly back for her father's funeral in 1985 over a quarrel about who had really raised her. Said for the rest of her life it was the worst decision she ever made.`,

  `---
id: p-david
slug: david-wong
names: { display: "David Wong", given: "David", family: "Wong", also_known_as: ["黃大衛"] }
sex: M
birth: { date: "1952-09-22", place: "Vancouver, Canada", lat: 49.250, lng: -123.119 }
living: true
tags: { talent: ["engineering"], health: ["hypertension"] }
unions: ["u-david-margaret"]
parents_union: "u-hongkeung-meiling"
---
## Story
First child born after the move to Canada. Mechanical engineer; spent
thirty-two years designing pulp-mill machinery up and down the Fraser
Valley. Quiet, steady, and — by his own admission — never as comfortable in
Cantonese as he wished he had been.

## Lessons & Mistakes
- {mistake: relationships} Refused to teach his children Cantonese ("they'll have a harder enough time being Canadian"). Said at his mother's deathbed it was the choice he most regretted as a father.
- {lesson: work} "Solve the problem you actually have." Wasted three years early in his career on an elegant design no one asked for. Never did it again.`,

  `---
id: p-susan
slug: susan-wong
names: { display: "Susan Wong", given: "Susan", family: "Wong", also_known_as: ["黃淑英"] }
sex: F
birth: { date: "1957", place: "Vancouver, Canada", lat: 49.250, lng: -123.119 }
living: true
tags: { talent: ["music", "languages"] }
unions: []
parents_union: "u-hongkeung-meiling"
---
## Story
Adopted as a newborn from a cousin in Hong Kong who couldn't keep her.
Mei-ling told her so on her seventh birthday and never spoke of it as
anything but ordinary. A concert pipa player; toured with the Vancouver
Chinese Music Ensemble for two decades.`,

  `---
id: p-daniel
slug: daniel-tran
names: { display: "Daniel Tran", given: "Daniel", family: "Tran", also_known_as: ["陳子聰", "Tran Tu-thong"] }
sex: M
birth: { date: "1960", place: "Saigon, Vietnam", lat: 10.823, lng: 106.629 }
living: true
tags: { talent: ["cooking"] }
unions: []
parents_union: "u-hongkeung-meiling"
---
## Story
Born in Cholon, Saigon's Chinese quarter, to a Teochew-Vietnamese mother
whose connection to Hong-keung dated to a year he was posted to Saigon as a
visiting physician. Raised by his mother and her family. Fled by boat in 1979
at nineteen; landed in a Toronto refugee hostel knowing two words of English.
Was tracked down by Mei-ling through a letter campaign across three Chinese
benevolent associations and welcomed into the Vancouver family at twenty-three.
Runs a Vietnamese-Cantonese restaurant in Scarborough that the cousins still
fly out for.

## Lessons & Mistakes
- {lesson: relationships} "A family that comes looking for you is the only kind worth answering." Took the bus across the country the week Mei-ling's letter found him.`,

  // ---- Generation 4 spouse ----
  `---
id: p-margaret
slug: margaret-osullivan-wong
names: { display: "Margaret O'Sullivan-Wong", given: "Margaret", family: "O'Sullivan-Wong", maiden: "O'Sullivan", also_known_as: ["Maggie"] }
sex: F
birth: { date: "1955", place: "Dublin, Ireland", lat: 53.350, lng: -6.260 }
living: true
tags: { talent: ["medicine"], faith: ["Catholic"] }
unions: ["u-david-margaret"]
parents_union: null
---
## Story
Trained as a nurse in Dublin, emigrated to Vancouver in 1978 on a
two-year contract that turned into a life. Met David at a Lions Gate
Hospital fundraiser; married 1983. Held the Wong-O'Sullivan Christmas
table together — turkey on one end, har gow on the other — for four
decades.`,

  // ---- Generation 5 ----
  `---
id: p-aaron
slug: aaron-wong
names: { display: "Aaron Wong", given: "Aaron", family: "Wong", also_known_as: ["黃浩然"] }
sex: M
birth: { date: "1987-04-30", place: "Vancouver, Canada", lat: 49.250, lng: -123.119 }
living: true
tags: { talent: ["writing", "languages"] }
unions: []
parents_union: "u-david-margaret"
---
## Story
Journalist; taught himself the Cantonese his father never gave him,
mostly by phone with his grandmother Mei-ling in her last year. Writes
about diaspora and labour for a Toronto monthly.`,

  // ---- Unions ----
  `---
id: u-ahfook-muilan
type: marriage
partners: ["p-ahfook", "p-muilan"]
status: widowed
start: "1879"
end: "1920"
children:
  - { person: "p-tinbo", relation: biological }
---
## Notes
Arranged marriage in Toishan, 1879. Four decades together; survived the fall
of the Qing and three famines.`,

  `---
id: u-kwokkeung-yuething
type: marriage
partners: ["p-kwokkeung", "p-yuething"]
status: widowed
start: "1891"
end: "1898"
children:
  - { person: "p-yukfan", relation: biological }
---
## Notes
Married in Sunwui, 1891. Kwok-keung sailed for Gold Mountain three years
later; the marriage was effectively over by the time he died on Jackson
Street in 1898.`,

  `---
id: u-tinbo-yukfan
type: marriage
partners: ["p-tinbo", "p-yukfan"]
status: widowed
start: "1913"
end: "1956"
children:
  - { person: "p-hongkeung", relation: biological }
---
## Notes
A marriage broker matched them across two continents. They met for the first
time at the wedding in Singapore in October 1913 and stayed together
forty-three years.`,

  `---
id: u-hongkeung-sauyi
type: marriage
partners: ["p-hongkeung", "p-sauyi"]
status: widowed
start: "1946"
end: "1947"
children:
  - { person: "p-karen", relation: biological }
---
## Notes
Married in Hong Kong in early 1946. Ended with Sau-yi's death in the 1947
cholera epidemic, sixteen months later.`,

  `---
id: u-hongkeung-meiling
type: marriage
partners: ["p-hongkeung", "p-meiling"]
status: married
start: "1948"
end: "1985"
children:
  - { person: "p-david", relation: biological }
  - { person: "p-susan", relation: adopted }
  - { person: "p-daniel", relation: step }
---
## Notes
Met in Hong Kong in 1948; married within the year. Mei-ling raised Karen as
her own from age three, adopted Susan as a newborn in 1957, and took in
Daniel — Hong-keung's son from before the marriage — when he reached Canada
in 1983.`,

  `---
id: u-david-margaret
type: marriage
partners: ["p-david", "p-margaret"]
status: married
start: "1983-08-13"
children:
  - { person: "p-aaron", relation: biological }
---
## Notes
Married in Vancouver, August 1983.`,
];

export function sampleDocs() {
  return FILES.map((text) => {
    const { data, body } = parseDoc(text);
    const kind = String(data.id || '').startsWith('u-') ? 'union' : 'person';
    return { kind, data, body };
  });
}

// The person the demo tree opens on — David Wong, the focus of the migration
// generation. From him the tree fans up through Singapore/Hong Kong/Penang to
// the Pearl River Delta, sideways to his step-, adopted-, and half-siblings,
// and down to his son in the present.
export const SAMPLE_FOCUS = 'p-david';
