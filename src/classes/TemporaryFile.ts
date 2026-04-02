import axios from "axios";
import { AttachmentBuilder } from "discord.js";
import { createWriteStream, emptyDirSync, existsSync, mkdirSync, readFileSync, rm, writeFileSync } from "fs-extra";

const workingDir = process.cwd();

async function downloadFile(fileUrl: string, outputLocationPath: string) {
    const writer = createWriteStream(outputLocationPath);

    return axios({
        method: "get",
        url: fileUrl,
        responseType: "stream",
    }).then((response) => {
        //ensure that the user can call `then()` only when the file has
        //been downloaded entirely.

        return new Promise((resolve, reject) => {
            response.data.pipe(writer);
            let error = null;
            writer.on("error", (err) => {
                error = err;
                writer.close();
                reject(err);
            });
            writer.on("close", () => {
                if (!error) {
                    resolve(true);
                }
                //no need to call the reject here, as it will have been called in the
                //'error' stream;
            });
        });
    });
}


/**
 * Handles temporary file storage.
 * @author the0show <3
 */
export class TemporaryFile {
    /**
     * The temporary file ID that this instance is associated with.
     */
    fileId: string;

    private constructor(tempFileId: string) {
        this.fileId = tempFileId;
    }

    /**
     * Creates a new temporary file.
     * @param file The file to store locally. If a `string` is provided then the file will be downloaded.
     * @returns A new instance of {@link TemporaryFile} that is linked to the newly created file.
     */
    static async create(file: string | Buffer) {
        const fileId = Date.now().toString();

        if (!existsSync(`${workingDir}/temp`)) mkdirSync(`${workingDir}/temp`);

        if (typeof file == "string") {
            await downloadFile(file, `${workingDir}/temp/${fileId}`);
        } else {
            writeFileSync(file, `${workingDir}/temp/${fileId}`);
        }

        return new TemporaryFile(fileId);
    }

    /**
     * Initializes the `temp/` directory and clears it.
     * **Do not call this method outside of `index.ts`.**
     */
    static init() {
        if (!existsSync(`${workingDir}/temp`)) mkdirSync(`${workingDir}/temp`);

        emptyDirSync(`${workingDir}/temp`);
    }

    /**
     * Finds an existing temporary file.
     * @param fileId The temporary file ID to find.
     * @returns A new instance of {@link TemporaryFile} that is linked to the requested file. If the file does not exist, an error will be thrown.
     *
     * @deprecated This method should only be used for debugging purposes. Temporary files should be owned (and freed) by the reference that created it.
     */
    static async find(fileId: string) {
        console.assert(existsSync(`${workingDir}/temp/${fileId}`));

        return new TemporaryFile(fileId);
    }

    /**
     * Reads the temporary file and returns the resulting {@link Buffer}
     * @returns The {@link Buffer}.
     */
    getBuffer() {
        return readFileSync(this.getPath());
    }

    /**
     * Removes the file from disk.
     * `fileId` will be set to `null` when this function is called.
     */
    free() {
        rm(`${workingDir}/temp/${this.fileId}`);
        this.fileId = null;
    }

    /**
     * Gets the location of the temporary file.
     * @returns The path to the temporary file.
     */
    getPath() {
        return `${workingDir}/temp/${this.fileId}`;
    }

    toDiscord(): AttachmentBuilder {
        return new AttachmentBuilder(this.getBuffer());
    }
}
