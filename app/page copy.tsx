"use client";

import Canvas from "@/components/Canvas";
import LeftSidebar from "@/components/LeftSidebar";
import Navbar from "@/components/Navbar";
import RightSidebar from "@/components/RightSidebar";
import { defaultNavElement } from "@/constants";
import {
  handleCanvaseMouseMove,
  handleCanvasMouseDown,
  handleCanvasMouseUp,
  handleCanvasObjectModified,
  handleCanvasObjectMoving,
  handleCanvasObjectScaling,
  handleCanvasSelectionCreated,
  handleCanvasZoom,
  handlePathCreated,
  handleResize,
  initializeFabric,
} from "@/lib/canvas";
import { handleDelete, handleKeyDown } from "@/lib/key-events";
import { handleImageUpload } from "@/lib/shapes";
import { ActiveElement, Attributes } from "@/types/type";
import { fabric } from "fabric";
import { useEffect, useRef, useState } from "react";

const Home = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const isDrawing = useRef(false);
  const shapeRef = useRef<fabric.Object | null>(null);
  const selectedShapeRef = useRef<string | null>(null);

  const activeObjectRef = useRef<fabric.Object | null>(null);
  const isEditingRef = useRef(false);

  const imageInputRef = useRef<HTMLInputElement>(null);

  const [activeElement, setActiveElement] = useState<ActiveElement>({
    name: "",
    value: "",
    icon: "",
  });

  const [elementAttributes, setElementAttributes] = useState<Attributes>({
    width: "",
    height: "",
    fontSize: "",
    fontFamily: "",
    fontWeight: "",
    fill: "#aabbcc",
    stroke: "#aabbcc",
  });

  const handleActiveElement = (elem: ActiveElement) => {
    setActiveElement(elem);

    switch (elem?.value) {
      case "reset":
        fabricRef.current?.clear();
        setActiveElement(defaultNavElement);
        break;
      case "delete":
        handleDelete(fabricRef.current as any);
        setActiveElement(defaultNavElement);
        break;
      case "image":
        break;
      case "comments":
        break;
      default:
        selectedShapeRef.current = elem?.value as string;
        break;
    }
  };

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }

    const canvas = initializeFabric({
      fabricRef,
      canvasRef,
    });

    canvas.on("mouse:down", (options) => {
      handleCanvasMouseDown({
        options,
        canvas,
        selectedShapeRef,
        isDrawing,
        shapeRef,
      });
    });

    canvas.on("mouse:move", (options) => {
      handleCanvaseMouseMove({
        options,
        canvas,
        isDrawing,
        selectedShapeRef,
        shapeRef,
      });
    });

    canvas.on("mouse:up", () => {
      handleCanvasMouseUp({
        canvas,
        isDrawing,
        shapeRef,
        activeObjectRef,
        selectedShapeRef,
        setActiveElement,
      });
    });

    canvas.on("path:created", (options) => {
      handlePathCreated({
        options,
      });
    });

    canvas.on("object:modified", (options) => {
      handleCanvasObjectModified({
        options,
      });
    });

    canvas.on("object:moving", (options) => {
      handleCanvasObjectMoving({
        options,
      });
    });

    canvas.on("selection:created", (options) => {
      handleCanvasSelectionCreated({
        options,
        isEditingRef,
        setElementAttributes,
      });
    });

    canvas.on("object:scaling", (options) => {
      handleCanvasObjectScaling({
        options,
        setElementAttributes,
      });
    });

    canvas.on("mouse:wheel", (options) => {
      handleCanvasZoom({
        options,
        canvas,
      });
    });

    canvas.on("text:changed", (event) => {
      const activeText = event.target as fabric.Textbox;
      if (activeText) {
        checkGrammar(activeText);
      }
    });

    return () => {
      canvas.dispose();
    };
  }, [canvasRef]);

  let activeSuggestionBox: HTMLElement | null = null;

  const highlightGrammarIssue = (
    textElement: fabric.Textbox,
    issues: { start: number; end: number; replacement: string }[]
  ) => {
    const text = textElement.text || "";

    clearGrammarHighlight(textElement, 0, text.length);

    issues.forEach((issue) => {
      for (let i = issue.start; i < issue.end; i++) {
        if (!textElement.styles[0]) {
          textElement.styles[0] = {};
        }

        textElement.styles[0][i] = {
          underline: true,
          fill: "red",
        };
      }

      textElement.canvas?.on("mouse:over", (e) => {
        const mousePointer = textElement.canvas?.getPointer(e.e);
        const boundingBox = textElement.getBoundingRect();

        const wordWidth = textElement.width / text.length;
        const issuePosition = issue.start * wordWidth;

        if (
          mousePointer &&
          mousePointer.x >= boundingBox.left + issuePosition &&
          mousePointer.x <=
            boundingBox.left +
              issuePosition +
              (issue.end - issue.start) * wordWidth &&
          mousePointer.y >= boundingBox.top &&
          mousePointer.y <= boundingBox.top + boundingBox.height
        ) {
          showSuggestionBox(textElement, issue); // Show suggestion on hover
        }
      });

      // Remove suggestion box on mouse out
      textElement.on("mouse:out", () => {
        if (activeSuggestionBox) {
          activeSuggestionBox.remove();
          activeSuggestionBox = null;
        }
      });
    });

    textElement.set("dirty", true);
    textElement.canvas?.renderAll();
  };

  const showSuggestionBox = (
    textElement: fabric.Textbox,
    issue: { start: number; end: number; replacement: string }
  ) => {
    if (activeSuggestionBox) {
      activeSuggestionBox.remove();
      activeSuggestionBox = null;
    }

    const textCoords = textElement.getBoundingRect();
    const canvasCoords = textElement.canvas
      ?.getElement()
      .getBoundingClientRect();

    if (canvasCoords && textCoords) {
      const suggestionBox = document.createElement("div");
      suggestionBox.className = "suggestion-box"; // Apply custom styles for the box
      suggestionBox.innerHTML = `<div class="suggestion">${issue.replacement}</div>`;
      suggestionBox.style.position = "absolute";
      suggestionBox.style.left = `${canvasCoords.left + textCoords.left}px`;
      suggestionBox.style.top = `${
        canvasCoords.top + textCoords.top + textCoords.height
      }px`;
      document.body.appendChild(suggestionBox);

      suggestionBox.addEventListener("click", () => {
        const currentText = textElement.text || "";
        const correctedText =
          currentText.substring(0, issue.start) +
          issue.replacement +
          currentText.substring(issue.end);

        textElement.set("text", correctedText);

        clearGrammarHighlight(textElement, issue.start, issue.end);
        textElement.set("dirty", true);
        textElement.canvas?.renderAll();

        suggestionBox.remove();
        activeSuggestionBox = null;
      });

      activeSuggestionBox = suggestionBox;
    }
  };

  const clearGrammarHighlight = (
    textElement: fabric.Textbox,
    start: number,
    end: number
  ) => {
    for (let i = start; i < end; i++) {
      if (textElement.styles[0] && textElement.styles[0][i]) {
        delete textElement.styles[0][i];
      }
    }

    textElement.set("dirty", true);
    textElement.canvas?.renderAll();
  };

  const checkGrammar = async (textElement: fabric.Textbox) => {
    const text = textElement.text || "";

    try {
      const response = await fetch("https://api.sapling.ai/api/v1/edits", {
        method: "POST",
        headers: {
          Authorization: "Bearer 02T1BD34ZL5ID0WUIH6R0NIF42LQDSY7",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: "02T1BD34ZL5ID0WUIH6R0NIF42LQDSY7",
          session_id: "your-session-id",
          text,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.msg || "Something went wrong");
      }

      const data = await response.json();

      console.log(data.edits);

      // Clear existing highlights before applying new ones
      clearGrammarHighlight(textElement, 0, text.length);

      if (data.edits.length > 0) {
        // Highlight all issues found
        highlightGrammarIssue(
          textElement,
          data.edits.map((issue: any) => ({
            start: issue.start,
            end: issue.end,
            replacement: issue.replacement,
          }))
        );
      } else {
        // No grammar issues found, so we clear all highlights
        clearGrammarHighlight(textElement, 0, text.length);
      }
    } catch (error) {
      console.error("Error checking grammar:", error);
    }
  };

  return (
    <main className="h-screen overflow-hidden">
      <Navbar
        imageInputRef={imageInputRef}
        activeElement={activeElement}
        handleActiveElement={handleActiveElement}
        handleImageUpload={(e: any) => {
          e.stopPropagation();
          handleImageUpload({
            file: e.target.files[0],
            canvas: fabricRef as any,
            shapeRef,
          });
        }}
      />
      <section className="flex h-full">
        <LeftSidebar />

        <Canvas canvasRef={canvasRef} />

        <RightSidebar />
      </section>
    </main>
  );
};

export default Home;
