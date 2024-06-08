import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterOutlet } from '@angular/router';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { Observable, map } from 'rxjs';
import { APP_CONSTANTS } from '../constants/app.constants';
import { DBService } from '../services/db.service';
import { UtilsService } from '../services/utils.service';
import { ChatService } from '../services/cohere.service';
import { CohereClient } from "cohere-ai";

export const LLM_MODES = {
  recommendation: "Recommendation System",
  qa: "Question Answering",
  rawLLM: "Raw LLM"
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, FormsModule, NgbDropdownModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  public title: string = "Stock.Ai";
  public streamText: string = "";
  public promptText: string = "";
  public llmModes: any = LLM_MODES;
  public selectedMode: string = LLM_MODES.recommendation;
  public sourceDocs: any[] = [];

  public isPristine: boolean = false;
  public isFetchingDocs: boolean = false;
  public isLoading: boolean = false;
  public hasError: boolean = false;
  public hasQAResult: boolean = false;
  public errorMessage: string = "";

  constructor(private db: DBService, private utils: UtilsService, private chat: ChatService) {
    this.isPristine = true;
  }

  private cohere = new CohereClient({
    token: APP_CONSTANTS.cohereKey
  });

  get isInTranstion(): boolean {
    return this.isFetchingDocs || this.isLoading;
  }

  get hasResult(): boolean {
    return !this.isInTranstion && !this.isPristine && !this.hasError;
  }

  get isInQAMode(): boolean {
    return this.hasQAResult;
  }

  getAnswer(): void {
    this.streamText = "";
    this.isPristine = false;
    this.hasError = false;
    this.hasQAResult = false;

    if (this.selectedMode == LLM_MODES.rawLLM) {
      try {
        let prepared_prompt = this.getPromptForLLM(this.promptText);
        this.isLoading = true;
        this.cohere.chat({
          model: "command-r",
          message: prepared_prompt,
        }).then((result) => {
          this.streamText = result.text || '';
          this.isLoading = false;
        });


      } catch (error) {
        console.error("Error processing GPT result", error);
        this.hasError = true;
        this.errorMessage = "Error in processing GPT result";
      }
    } else {
      this.isFetchingDocs = true;
      const request = this.selectedMode == LLM_MODES.recommendation ? this.getRecommendation() : this.getQAResponse();
      request.pipe(
        map((data) => {
          this.isFetchingDocs = false;
          if (data.context && data.context.doc_count > 0) {
            this.sourceDocs = data.context.documents.map((doc: any) => doc.metadata);
          }
          else if (data.documentList) {
            this.sourceDocs = data.documentList;
          }
          return data.prompt;
        })).subscribe({
          next: async (prepared_prompt: string) => {
            try {
              this.isLoading = true;
              console.log("Prompt for Cohere R Model: ", prepared_prompt);
              this.cohere.chat({
                model: "command-r",
                message: prepared_prompt,
              }).then((result) => {
                this.streamText = result.text || '';
                this.isLoading = false;
              });
            } catch (error) {
              console.error("Error processing the LLM result", error);
              this.hasError = true;
              this.errorMessage = "Error in processing LLM result";
            }
          }, error: (err) => {
            console.error("Error from DB call", err);
            this.isFetchingDocs = false;
            this.hasError = true;
            this.errorMessage = "Error in fetching documents";
          }
        });
    }
  }

  private getQAResponse(): Observable<any> {
    this.hasQAResult = true;
    return this.db.getQAPrompt(this.promptText);
  }

  private getRecommendation(): Observable<any> {
    this.hasQAResult = true;
    return this.db.getRecommendationPrompt(this.promptText);
  }
  
  public changeMode(mode: any) {
    if (mode && this.llmModes[mode]) {
      this.selectedMode = this.llmModes[mode];
    }
  }

  public getPromptForLLM(prompt:string){
    let completedQuestion = "Return a concised response in less than 200 words."
    prompt = prompt + completedQuestion;
    return prompt;
  }
}
