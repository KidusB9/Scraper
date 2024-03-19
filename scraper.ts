import { RequestHandler, Request, Response } from "express";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { Listing } from "./listing.interface";

puppeteer.use(StealthPlugin());

export const getData: RequestHandler = async (req: Request, res: Response) => {
    console.log("getData in scraper.ts is called");
    const city = req.query.city as string;
    const pageLimit = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 10;

    const browser = await puppeteer.launch({ headless: false });
    const currentPage = await browser.newPage();
    await currentPage.setViewport({ width: 1920, height: 1080 });

    try {
        const searchUrl = `https://www.zillow.com/homes/${city}_rb/`;
        await currentPage.goto(searchUrl, { waitUntil: 'networkidle0' });

        const listings: Listing[] = [];
        
        for (let i = 0; i < pageLimit; i++) {
            await currentPage.waitForSelector('#grid-search-results ul');
            const urls = await currentPage.evaluate(() => {
                const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("#grid-search-results > ul > li > article > a"));
                return links.map(a => a.href);
            });

            for (const url of urls.slice(0, size)) {
                await currentPage.goto(url, { waitUntil: 'networkidle0' });
                const listing = await currentPage.evaluate(() => {
                    const price = document.querySelector('[data-test="property-card-price"]')?.textContent ?? 'No price';
                    const address = document.querySelector('[data-test="property-card-addr"]')?.textContent ?? 'No address';
                    const bedrooms = document.querySelector('[data-test="property-card-beds"]')?.textContent ?? 'No bedrooms';
                    const bathrooms = document.querySelector('[data-test="property-card-baths"]')?.textContent ?? 'No bathrooms';
                    const squareFootage = document.querySelector('[data-test="property-card-sqft"]')?.textContent ?? 'No sqft';
                    const details = document.querySelector("[class^=StyledPropertyCardHomeDetailsList]")?.textContent ?? 'No details';
                   
                    return { price, address, bedrooms, bathrooms, squareFootage, details };
                });

                listings.push(listing);

                if (listings.length >= size) break;
            }

            if (listings.length >= size || i >= pageLimit - 1) break;

            // Handle pagination
            const nextPageButton = await currentPage.$('a.next');
            if (nextPageButton) {
                await nextPageButton.click();
                await currentPage.waitForNavigation({ waitUntil: 'networkidle0' });
            } else {
                break; // No more pages
            }
        }

        res.status(200).json(listings);
    } catch (error) {
        console.error('An error occurred:', error);
        res.status(500).json({ error: 'Failed to fetch data' });
    } finally {
        await browser.close();
    }
};
