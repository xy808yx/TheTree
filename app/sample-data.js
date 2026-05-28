// A small but deliberately messy sample family, used for the first-run demo and
// for verification. It exercises: remarriage, adoption, step-child, half-sibling,
// unknown parentage, partial/approximate dates, namespaced tags, and tagged
// lessons/mistakes. Each child is listed in exactly one union (their parents_union).

import { parseDoc } from './parse.js';

const FILES = [
  // ---- Generation 1: great-grandparents ----
  `---
id: p-samuel
slug: samuel-vance
names: { display: "Samuel Vance", given: "Samuel", family: "Vance" }
sex: M
birth: { date: "1888", place: "Lanark, Scotland" }
death: { date: "1951", place: "Hamilton, Canada" }
living: false
unions: ["u-samuel-mary"]
parents_union: null
---
## Story
A tenant farmer who emigrated to Ontario in 1912 chasing cheap land.

## Lessons & Mistakes
- {mistake: money} Mortgaged the farm to speculate on wheat futures and lost almost everything in 1929. The family rented for a generation after.`,

  `---
id: p-mary
slug: mary-vance
names: { display: "Mary Vance", given: "Mary", family: "Vance", maiden: "Doyle" }
sex: F
birth: { date: "1892", place: "Cork, Ireland" }
death: { date: "1970", place: "Hamilton, Canada" }
living: false
tags: { faith: ["devout"] }
unions: ["u-samuel-mary"]
parents_union: null
---
## Story
Held the household together through the Depression by taking in boarders.

## Lessons & Mistakes
- {lesson: faith} Never let a Sunday pass without the whole family at one table — said the table mattered more than the church.`,

  `---
id: p-adeyemi
slug: adeyemi-okafor
names: { display: "Adeyemi Okafor", given: "Adeyemi", family: "Okafor" }
sex: M
birth: { date: "abt 1890", place: "Abeokuta, Nigeria" }
death: { date: "1960", place: "Lagos, Nigeria" }
living: false
tags: { talent: ["oratory"] }
unions: ["u-adeyemi-grace"]
parents_union: null
---
## Story
A schoolteacher and lay preacher known across the district for his speaking.`,

  `---
id: p-grace
slug: grace-okafor
names: { display: "Grace Okafor", given: "Grace", family: "Okafor", maiden: "Balogun" }
sex: F
birth: { date: "1895", place: "Ibadan, Nigeria" }
death: { date: "1972", place: "Lagos, Nigeria" }
living: false
unions: ["u-adeyemi-grace"]
parents_union: null
---
## Story
A trader who ran a textile stall and quietly funded the schooling of a dozen nieces and nephews.

## Lessons & Mistakes
- {lesson: relationships} Gave without keeping score, and was never short of help when she needed it.`,

  // ---- Generation 2: grandparents ----
  `---
id: p-thomas
slug: thomas-vance
names: { display: "Thomas Vance", given: "Thomas", family: "Vance", also_known_as: ["Tom"] }
sex: M
birth: { date: "1920-03-02", place: "Hamilton, Canada" }
death: { date: "1995", place: "Vancouver, Canada" }
living: false
tags: { talent: ["carpentry"], health: ["heart-disease"] }
photos:
  - { file: "thomas-workshop.jpg", caption: "In his workshop", date: "1971" }
unions: ["u-thomas-rose", "u-thomas-eleanor"]
parents_union: "u-samuel-mary"
---
## Story
A cabinetmaker who served in the navy, was widowed young, and remarried in Lagos
while posted overseas.

## Lessons & Mistakes
- {lesson: work} Learned a trade with his hands that fed the family in every economy — never out of work a single year.
- {mistake: health} Ignored chest pains for over a year because he "didn't have time to be sick." The first heart attack nearly killed him.`,

  `---
id: p-rose
slug: rose-vance
names: { display: "Rose Vance", given: "Rose", family: "Vance", maiden: "Whitfield" }
sex: F
birth: { date: "1922", place: "Halifax, Canada" }
death: { date: "1958", place: "Hamilton, Canada" }
living: false
unions: ["u-thomas-rose"]
parents_union: null
---
## Story
Thomas's first wife; a nurse who died of tuberculosis when their son Sam was an infant.`,

  `---
id: p-eleanor
slug: eleanor-vance
names: { display: "Eleanor Vance", given: "Eleanor", family: "Vance", maiden: "Okafor", also_known_as: ["Nell"] }
sex: F
birth: { date: "1938-04-12", place: "Lagos, Nigeria" }
death: { date: "abt 2019", place: "Vancouver, Canada" }
living: false
tags: { talent: ["painting", "languages"], health: ["breast-cancer-survivor"] }
photos:
  - { file: "eleanor-1980.jpg", caption: "Studio portrait", date: "1980" }
  - { file: "eleanor-wedding.jpg", caption: "Wedding to Thomas", date: "1962-06" }
unions: ["u-thomas-eleanor"]
parents_union: "u-adeyemi-grace"
---
## Story
Trained as a painter in Lagos, spoke four languages, and emigrated to Canada in
1961 where she met Thomas.

## Lessons & Mistakes
- {lesson: money} Kept six months of expenses in cash at all times — it carried the family through the 1982 layoffs without a single missed payment.
- {mistake: relationships} Cut off her younger brother over their mother's inheritance and never spoke to him again. Regretted it openly in her last years.`,

  // ---- Generation 3: the focus generation ----
  `---
id: p-sam2
slug: sam-vance
names: { display: "Sam Vance", given: "Samuel", family: "Vance" }
sex: M
birth: { date: "1957", place: "Hamilton, Canada" }
living: true
tags: { talent: ["boxing"] }
unions: []
parents_union: "u-thomas-rose"
---
## Story
Thomas and Rose's son, raised partly by his stepmother Eleanor after Rose died.
A Golden Gloves boxer in his youth.`,

  `---
id: p-marcus
slug: marcus-vance
names: { display: "Marcus Vance", given: "Marcus", family: "Vance" }
sex: M
birth: { date: "1965-09-18", place: "Vancouver, Canada" }
living: true
tags: { talent: ["running", "writing"] }
unions: ["u-marcus-lerato"]
parents_union: "u-thomas-eleanor"
---
## Story
A long-distance runner turned journalist.

## Lessons & Mistakes
- {lesson: relationships} Watched his mother lose her brother to a grudge and made a rule: never let a disagreement outlive a year.`,

  `---
id: p-grace2
slug: grace-vance
names: { display: "Grace Vance", given: "Grace", family: "Vance" }
sex: F
birth: { date: "1968", place: "Vancouver, Canada" }
living: true
tags: { talent: ["medicine"] }
unions: []
parents_union: "u-thomas-eleanor"
---
## Story
Adopted by Thomas and Eleanor as an infant; became a pediatric surgeon.`,

  `---
id: p-daniel
slug: daniel-vance
names: { display: "Daniel Vance", given: "Daniel", family: "Vance" }
sex: M
birth: { date: "1960", place: "Lagos, Nigeria" }
living: true
unions: []
parents_union: "u-thomas-eleanor"
---
## Story
Eleanor's son from before her marriage; his birth father is unknown. Thomas
raised him as his own.`,

  `---
id: p-lerato
slug: lerato-vance
names: { display: "Lerato Vance", given: "Lerato", family: "Vance", maiden: "Molefe" }
sex: F
birth: { date: "1967", place: "Gaborone, Botswana" }
living: true
tags: { talent: ["medicine"] }
unions: ["u-marcus-lerato"]
parents_union: null
---
## Story
A physician who married into the family; her own parentage is not yet recorded.`,

  // ---- Generation 4 ----
  `---
id: p-thandi
slug: thandi-vance
names: { display: "Thandi Vance", given: "Thandi", family: "Vance" }
sex: F
birth: { date: "1992", place: "Vancouver, Canada" }
living: true
tags: { talent: ["running", "mathematics"] }
unions: []
parents_union: "u-marcus-lerato"
---
## Story
Provincial cross-country champion; studying applied mathematics.`,

  `---
id: p-kofi
slug: kofi-vance
names: { display: "Kofi Vance", given: "Kofi", family: "Vance" }
sex: M
birth: { date: "1995", place: "Vancouver, Canada" }
living: true
tags: { talent: ["music"] }
unions: []
parents_union: "u-marcus-lerato"
---
## Story
A jazz pianist.`,

  // ---- Unions ----
  `---
id: u-samuel-mary
type: marriage
partners: ["p-samuel", "p-mary"]
status: widowed
start: "1915"
end: "1951"
children:
  - { person: "p-thomas", relation: biological }
---
## Notes
Married in Hamilton in 1915.`,

  `---
id: u-adeyemi-grace
type: marriage
partners: ["p-adeyemi", "p-grace"]
status: widowed
start: "1930"
children:
  - { person: "p-eleanor", relation: biological }
---
## Notes
Married in Lagos.`,

  `---
id: u-thomas-rose
type: marriage
partners: ["p-thomas", "p-rose"]
status: widowed
start: "1955"
end: "1958"
children:
  - { person: "p-sam2", relation: biological }
---
## Notes
Thomas's first marriage; ended with Rose's death in 1958.`,

  `---
id: u-thomas-eleanor
type: marriage
partners: ["p-thomas", "p-eleanor"]
status: divorced
start: "1962-06"
end: "1979"
children:
  - { person: "p-marcus", relation: biological }
  - { person: "p-grace2", relation: adopted }
  - { person: "p-daniel", relation: step }
---
## Notes
Met in Lagos in 1960; married 1962, divorced 1979.`,

  `---
id: u-marcus-lerato
type: marriage
partners: ["p-marcus", "p-lerato"]
status: married
start: "1990"
children:
  - { person: "p-thandi", relation: biological }
  - { person: "p-kofi", relation: biological }
---
## Notes
Married in Vancouver in 1990.`,
];

export function sampleDocs() {
  return FILES.map((text) => {
    const { data, body } = parseDoc(text);
    const kind = String(data.id || '').startsWith('u-') ? 'union' : 'person';
    return { kind, data, body };
  });
}

// The person the demo tree opens on.
export const SAMPLE_FOCUS = 'p-marcus';
