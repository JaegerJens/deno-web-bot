import puppeteer, { Browser } from "https://deno.land/x/puppeteer@16.2.0/mod.ts";

enum JobCategory {
    KI = 'ingenieur-in-für-künstliche-intelligenz',
}

function buildRequestUrl(category: JobCategory, page: number): URL {
    const stepstone = 'https://www.stepstone.de/';
    const path = `jobs/${category}`;
    const result = new URL(path, stepstone);
    if (page > 1) {
        result.searchParams.set('page', `${page}`);
    }
    return result;
}

interface HTMLElement {
    classList: string[];
    innerText: string;
}

interface HtmlArticleDetails {
    text: string;
    types: string[];
}

const articleTitleSelector = 'article a[data-genesis-element=BASE]';

interface JobEntry {
    detailsLink: URL;
}

const introductionClass = 'at-section-text-introduction';
const descriptionClass = 'at-section-text-description';
const profileClass = 'at-section-text-profile';
const offerClass = 'at-section-text-weoffer';

interface JobDetails extends JobEntry {
    introduction?: string;
    description?: string;
    profile?: string;
    offer?: string;
}

async function getJobList(browser: Browser, category: JobCategory): Promise<JobEntry[]> {
    const page = await browser.newPage();
    await page.goto(buildRequestUrl(category, 1).href);
    await page.waitForSelector('input[data-genesis-element=FORM_INPUT]', { timeout: 6000 });
    const list: string[] = await page.$$eval(articleTitleSelector, list => list.map(el => el.href));
    const result: JobEntry[] = list.filter(link => link.includes('stellenangebote--')).map(link => ({ detailsLink: new URL(link) }));
    page.close();

    return result;
}



async function getJobDetails(browser: Browser, job: JobEntry): Promise<JobDetails> {
    const page = await browser.newPage();
    await page.goto(job.detailsLink.href);
    const sections: HtmlArticleDetails[]  = [...await page.$$eval('article', list =>
        [...list].filter(
            (element: HTMLElement) => [...element.classList].find(className => className.startsWith('at-section-text-') !== undefined)
        ).map(
            (article: HTMLElement) => ({ text: article.innerText, types: [...article.classList] })
        ))];

    page.close();

    return {
        ...job,
        introduction: sections.find(article => article.types.includes(introductionClass))?.text,
        description: sections.find(article => article.types.includes(descriptionClass))?.text,
        profile: sections.find(article => article.types.includes(profileClass))?.text,
        offer: sections.find(article => article.types.includes(offerClass))?.text,
    };
}

async function main() {
    const browser = await puppeteer.launch({ headless: false });
    const jobList = await getJobList(browser, JobCategory.KI);

    const details: JobDetails[] = [];
    for await (const job of jobList) {
        const jobInfo = await getJobDetails(browser, job);
        details.push(jobInfo);
        console.log(jobInfo);
    }

    await browser.close();

    await Deno.writeTextFile('job-offers.json', JSON.stringify(details));
}

await main();
